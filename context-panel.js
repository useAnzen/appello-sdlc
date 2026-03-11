(function () {
    var cfg = window.FEEDBACK_CONFIG;
    if (!cfg) return;

    var slug = location.pathname.split("/").pop().replace(".html", "");
    var API = cfg.supabaseUrl + "/rest/v1";
    var headers = {
        apikey: cfg.supabaseKey,
        Authorization: "Bearer " + cfg.supabaseKey
    };

    var STATUS_META = {
        draft: { label: "Draft", bg: "#f1f5f9", color: "#475569", icon: "○" },
        pending_review: { label: "Pending Review", bg: "#fef3c7", color: "#92400e", icon: "◔" },
        needs_changes: { label: "Needs Changes", bg: "#fee2e2", color: "#991b1b", icon: "✎" },
        approved: { label: "Approved", bg: "#d1fae5", color: "#065f46", icon: "✓" },
        in_development: { label: "In Development", bg: "#dbeafe", color: "#1e40af", icon: "⚙" },
        in_review: { label: "In Review", bg: "#ede9fe", color: "#5b21b6", icon: "◉" },
        deployed: { label: "Deployed", bg: "#d1fae5", color: "#065f46", icon: "★" }
    };

    function esc(s) {
        var d = document.createElement("div");
        d.textContent = s || "";
        return d.innerHTML;
    }

    function buildPanel() {
        var panel = document.createElement("div");
        panel.id = "ctx-panel";
        panel.innerHTML = '<style>' +
            '#ctx-panel{position:fixed;bottom:24px;left:24px;z-index:9000;font-family:"Inter",-apple-system,sans-serif}' +
            '#ctx-toggle{background:#1e293b;color:#e2e8f0;border:none;border-radius:10px;padding:10px 16px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:8px;transition:background 0.15s}' +
            '#ctx-toggle:hover{background:#334155}' +
            '#ctx-toggle .ctx-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}' +
            '#ctx-body{display:none;position:absolute;bottom:48px;left:0;width:340px;max-height:70vh;background:#fff;border:1px solid #e2e6ea;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.12);overflow-y:auto;overflow-x:hidden}' +
            '#ctx-body.open{display:block}' +
            '.ctx-header{padding:14px 16px;border-bottom:1px solid #e2e6ea;display:flex;align-items:center;justify-content:space-between}' +
            '.ctx-header h4{font-size:13px;font-weight:700;color:#1a2332;margin:0}' +
            '.ctx-status{font-size:11px;font-weight:600;padding:3px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:4px}' +
            '.ctx-section{padding:12px 16px;border-bottom:1px solid #f1f5f9}' +
            '.ctx-section:last-child{border-bottom:none}' +
            '.ctx-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;margin-bottom:6px}' +
            '.ctx-item{font-size:12px;color:#1a2332;padding:4px 0;display:flex;align-items:center;gap:6px}' +
            '.ctx-item a{color:#2563eb;text-decoration:none;font-weight:500}' +
            '.ctx-item a:hover{text-decoration:underline}' +
            '.ctx-badge{font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;background:#f1f5f9;color:#475569}' +
            '.ctx-empty{font-size:11px;color:#94a3b8;font-style:italic}' +
            '.ctx-link-row{display:flex;gap:8px;flex-wrap:wrap}' +
            '.ctx-link-btn{font-size:11px;font-weight:600;color:#2563eb;text-decoration:none;background:#eff4ff;padding:5px 12px;border-radius:6px;transition:background 0.15s}' +
            '.ctx-link-btn:hover{background:#dbeafe}' +
            '</style>' +
            '<button id="ctx-toggle"><span class="ctx-dot"></span> Work Package</button>' +
            '<div id="ctx-body"></div>';

        document.body.appendChild(panel);

        document.getElementById("ctx-toggle").addEventListener("click", function () {
            var body = document.getElementById("ctx-body");
            body.classList.toggle("open");
        });

        loadContext();
    }

    function loadContext() {
        fetch(API + "/work_packages?slug=eq." + slug + "&limit=1", { headers: headers })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!Array.isArray(data) || data.length === 0) {
                    setToggleState("gray", "Not Registered");
                    renderNotFound();
                    return;
                }
                var wp = data[0];
                var meta = STATUS_META[wp.status] || STATUS_META.draft;
                setToggleState(meta.color, meta.label);

                Promise.all([
                    fetch(API + "/work_package_tickets?work_package_id=eq." + wp.id + "&order=created_at.asc", { headers: headers }).then(function (r) { return r.json(); }),
                    fetch(API + "/work_package_prs?work_package_id=eq." + wp.id + "&order=created_at.asc", { headers: headers }).then(function (r) { return r.json(); }),
                    fetch(API + "/feedback?document_slug=eq." + slug + "&order=created_at.desc", { headers: headers }).then(function (r) { return r.json(); })
                ]).then(function (results) {
                    var tickets = Array.isArray(results[0]) ? results[0] : [];
                    var prs = Array.isArray(results[1]) ? results[1] : [];
                    var feedback = Array.isArray(results[2]) ? results[2] : [];
                    renderPanel(wp, tickets, prs, feedback);
                });
            })
            .catch(function () {
                setToggleState("#94a3b8", "Error");
            });
    }

    function setToggleState(color, label) {
        var dot = document.querySelector("#ctx-toggle .ctx-dot");
        if (dot) dot.style.background = color;
        var btn = document.getElementById("ctx-toggle");
        if (btn) {
            btn.innerHTML = '<span class="ctx-dot" style="background:' + color + '"></span> ' + esc(label);
        }
    }

    function renderNotFound() {
        document.getElementById("ctx-body").innerHTML =
            '<div class="ctx-header"><h4>Work Package</h4></div>' +
            '<div class="ctx-section"><p class="ctx-empty">This spec is not yet registered as a work package.</p></div>';
    }

    function renderPanel(wp, tickets, prs, feedback) {
        var meta = STATUS_META[wp.status] || STATUS_META.draft;
        var html = '';

        html += '<div class="ctx-header">' +
            '<h4>' + esc(wp.title) + '</h4>' +
            '<span class="ctx-status" style="background:' + meta.bg + ';color:' + meta.color + '">' + meta.icon + ' ' + esc(meta.label) + '</span>' +
        '</div>';

        if (wp.implementation_plan_url || wp.canvas_url) {
            html += '<div class="ctx-section"><div class="ctx-label">Resources</div><div class="ctx-link-row">';
            if (wp.implementation_plan_url) {
                html += '<a class="ctx-link-btn" href="' + esc(wp.implementation_plan_url) + '" target="_blank">Implementation Plan</a>';
            }
            if (wp.canvas_url) {
                html += '<a class="ctx-link-btn" href="' + esc(wp.canvas_url) + '" target="_blank">Canvas</a>';
            }
            html += '</div></div>';
        }

        html += '<div class="ctx-section"><div class="ctx-label">Jira Tickets</div>';
        if (tickets.length === 0) {
            html += '<p class="ctx-empty">No tickets linked yet</p>';
        } else {
            tickets.forEach(function (t) {
                html += '<div class="ctx-item">' +
                    '<a href="' + esc(t.jira_url) + '" target="_blank">' + esc(t.jira_key) + '</a>' +
                    (t.jira_summary ? '<span>' + esc(t.jira_summary) + '</span>' : '') +
                    (t.jira_status ? '<span class="ctx-badge">' + esc(t.jira_status) + '</span>' : '') +
                '</div>';
            });
        }
        html += '</div>';

        if (prs.length > 0) {
            html += '<div class="ctx-section"><div class="ctx-label">Pull Requests</div>';
            prs.forEach(function (p) {
                var prColor = p.pr_status === "merged" ? "#065f46" : (p.pr_status === "closed" ? "#991b1b" : "#92400e");
                var prBg = p.pr_status === "merged" ? "#d1fae5" : (p.pr_status === "closed" ? "#fee2e2" : "#fef3c7");
                html += '<div class="ctx-item">' +
                    (p.pr_url ? '<a href="' + esc(p.pr_url) + '" target="_blank">#' + p.pr_number + '</a>' : '<span>#' + p.pr_number + '</span>') +
                    '<span>' + esc(p.pr_title) + '</span>' +
                    '<span class="ctx-badge" style="background:' + prBg + ';color:' + prColor + '">' + esc(p.pr_status) + '</span>' +
                '</div>';
            });
            html += '</div>';
        }

        var approvedCount = feedback.filter(function (f) { return f.status === "approved"; }).length;
        var changesCount = feedback.filter(function (f) { return f.status === "needs_changes" && !f.is_addressed; }).length;
        var rejectedCount = feedback.filter(function (f) { return f.status === "rejected" && !f.is_addressed; }).length;
        var totalFb = feedback.length;

        if (totalFb > 0) {
            html += '<div class="ctx-section"><div class="ctx-label">Feedback (' + totalFb + ')</div>';
            html += '<div class="ctx-item">';
            if (approvedCount > 0) html += '<span class="ctx-badge" style="background:#d1fae5;color:#065f46">' + approvedCount + ' approved</span>';
            if (changesCount > 0) html += '<span class="ctx-badge" style="background:#fef3c7;color:#92400e">' + changesCount + ' needs changes</span>';
            if (rejectedCount > 0) html += '<span class="ctx-badge" style="background:#fee2e2;color:#991b1b">' + rejectedCount + ' rejected</span>';
            html += '</div></div>';
        }

        html += '<div class="ctx-section" style="text-align:center;padding:10px 16px">' +
            '<a class="ctx-link-btn" href="../pipeline.html" style="width:100%;display:block;text-align:center">View Pipeline</a>' +
        '</div>';

        document.getElementById("ctx-body").innerHTML = html;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildPanel);
    } else {
        buildPanel();
    }
})();
