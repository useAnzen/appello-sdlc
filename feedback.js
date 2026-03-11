(function () {
    const cfg = window.FEEDBACK_CONFIG;
    if (!cfg) return;

    const slug = location.pathname.split("/").pop().replace(".html", "");
    const API = cfg.supabaseUrl + "/rest/v1/feedback";
    const headers = {
        apikey: cfg.supabaseKey,
        Authorization: "Bearer " + cfg.supabaseKey,
        "Content-Type": "application/json",
        Prefer: "return=representation"
    };

    const STATUS_META = {
        approved: { label: "Approved", bg: "#d1fae5", color: "#065f46", icon: "\u2713" },
        needs_changes: { label: "Needs Changes", bg: "#fef3c7", color: "#92400e", icon: "\u270E" },
        rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b", icon: "\u2717" }
    };

    function timeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return mins + "m ago";
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + "h ago";
        const days = Math.floor(hrs / 24);
        if (days < 30) return days + "d ago";
        return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    function buildWidget() {
        const root = document.createElement("div");
        root.id = "fb-root";
        root.innerHTML = `
        <style>
            #fb-root { font-family: "Inter", "DM Sans", -apple-system, sans-serif; max-width: 960px; margin: 3rem auto; padding: 0 1.5rem; }
            #fb-root * { box-sizing: border-box; }
            .fb-divider { border: none; border-top: 2px solid #e2e8f0; margin: 0 0 2rem; }
            .fb-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem; color: #1a2332; }
            .fb-subtitle { font-size: 0.88rem; color: #5a6577; margin-bottom: 1.5rem; }

            .fb-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 2rem; }
            .fb-item { background: #fff; border: 1px solid #e2e6ea; border-radius: 10px; padding: 16px 20px; }
            .fb-item-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
            .fb-reviewer { font-weight: 600; font-size: 0.88rem; color: #1a2332; }
            .fb-company { font-size: 0.78rem; color: #5a6577; }
            .fb-time { font-size: 0.72rem; color: #94a3b8; margin-left: auto; }
            .fb-status-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; padding: 3px 10px; border-radius: 6px; }
            .fb-comment { font-size: 0.85rem; color: #334155; line-height: 1.6; white-space: pre-wrap; }
            .fb-empty { text-align: center; padding: 2rem; color: #94a3b8; font-size: 0.88rem; }

            .fb-form { background: #fff; border: 1px solid #e2e6ea; border-radius: 12px; padding: 24px; }
            .fb-form-title { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: #1a2332; }
            .fb-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
            .fb-field { display: flex; flex-direction: column; gap: 4px; }
            .fb-field label { font-size: 0.72rem; font-weight: 600; color: #5a6577; text-transform: uppercase; letter-spacing: 0.04em; }
            .fb-field input, .fb-field textarea {
                border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 12px;
                font-size: 0.85rem; font-family: inherit; color: #1a2332;
                outline: none; transition: border-color 0.15s;
            }
            .fb-field input:focus, .fb-field textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
            .fb-field textarea { min-height: 100px; resize: vertical; }

            .fb-status-group { margin-bottom: 12px; }
            .fb-status-group label { font-size: 0.72rem; font-weight: 600; color: #5a6577; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
            .fb-status-options { display: flex; gap: 8px; }
            .fb-status-btn {
                flex: 1; padding: 10px 12px; border: 2px solid #e2e6ea; border-radius: 8px;
                background: #fff; font-size: 0.82rem; font-weight: 600; font-family: inherit;
                cursor: pointer; text-align: center; transition: all 0.15s; color: #5a6577;
            }
            .fb-status-btn:hover { border-color: #94a3b8; }
            .fb-status-btn[data-selected="true"][data-status="approved"] { border-color: #10b981; background: #d1fae5; color: #065f46; }
            .fb-status-btn[data-selected="true"][data-status="needs_changes"] { border-color: #f59e0b; background: #fef3c7; color: #92400e; }
            .fb-status-btn[data-selected="true"][data-status="rejected"] { border-color: #ef4444; background: #fee2e2; color: #991b1b; }

            .fb-submit {
                width: 100%; padding: 12px; border: none; border-radius: 8px;
                background: #2563eb; color: #fff; font-size: 0.88rem; font-weight: 600;
                font-family: inherit; cursor: pointer; transition: background 0.15s; margin-top: 8px;
            }
            .fb-submit:hover { background: #1d4ed8; }
            .fb-submit:disabled { background: #94a3b8; cursor: not-allowed; }

            .fb-success {
                text-align: center; padding: 1.5rem; background: #d1fae5; border-radius: 10px;
                color: #065f46; font-weight: 600; font-size: 0.88rem; margin-top: 12px; display: none;
            }
            .fb-error {
                text-align: center; padding: 1rem; background: #fee2e2; border-radius: 10px;
                color: #991b1b; font-size: 0.82rem; margin-top: 8px; display: none;
            }
            .fb-count { font-size: 0.82rem; color: #94a3b8; font-weight: 400; }
            @media (max-width: 600px) { .fb-row { grid-template-columns: 1fr; } .fb-status-options { flex-direction: column; } }
        </style>
        <hr class="fb-divider">
        <div class="fb-title">Feedback <span class="fb-count" id="fb-count"></span></div>
        <div class="fb-subtitle">Review this document and share your feedback. All responses are visible to the team.</div>
        <div class="fb-list" id="fb-list"></div>
        <div class="fb-form" id="fb-form">
            <div class="fb-form-title">Leave Feedback</div>
            <div class="fb-row">
                <div class="fb-field">
                    <label>Your Name *</label>
                    <input type="text" id="fb-name" placeholder="e.g. Nick Newman">
                </div>
                <div class="fb-field">
                    <label>Company</label>
                    <input type="text" id="fb-company" placeholder="e.g. Rival Insulation">
                </div>
            </div>
            <div class="fb-status-group">
                <label>Decision *</label>
                <div class="fb-status-options" id="fb-status-options">
                    <button class="fb-status-btn" data-status="approved" data-selected="false">\u2713 Approve</button>
                    <button class="fb-status-btn" data-status="needs_changes" data-selected="false">\u270E Needs Changes</button>
                    <button class="fb-status-btn" data-status="rejected" data-selected="false">\u2717 Reject</button>
                </div>
            </div>
            <div class="fb-field">
                <label>Comments *</label>
                <textarea id="fb-comment" placeholder="What changes are needed? What looks good? Be specific..."></textarea>
            </div>
            <button class="fb-submit" id="fb-submit">Submit Feedback</button>
            <div class="fb-success" id="fb-success">Feedback submitted. Thank you for your review.</div>
            <div class="fb-error" id="fb-error"></div>
        </div>`;

        document.body.appendChild(root);
        initWidget();
    }

    function initWidget() {
        let selectedStatus = null;

        document.querySelectorAll(".fb-status-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                document.querySelectorAll(".fb-status-btn").forEach(function (b) { b.dataset.selected = "false"; });
                btn.dataset.selected = "true";
                selectedStatus = btn.dataset.status;
            });
        });

        document.getElementById("fb-submit").addEventListener("click", function () {
            var name = document.getElementById("fb-name").value.trim();
            var company = document.getElementById("fb-company").value.trim();
            var comment = document.getElementById("fb-comment").value.trim();
            var errEl = document.getElementById("fb-error");
            var successEl = document.getElementById("fb-success");
            errEl.style.display = "none";
            successEl.style.display = "none";

            if (!name || !selectedStatus || !comment) {
                errEl.textContent = "Please fill in your name, select a decision, and add a comment.";
                errEl.style.display = "block";
                return;
            }

            var submitBtn = document.getElementById("fb-submit");
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";

            fetch(API, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    document_slug: slug,
                    reviewer_name: name,
                    reviewer_company: company || null,
                    status: selectedStatus,
                    comment: comment
                })
            })
                .then(function (res) {
                    if (!res.ok) throw new Error("Failed to submit");
                    return res.json();
                })
                .then(function () {
                    successEl.style.display = "block";
                    document.getElementById("fb-name").value = "";
                    document.getElementById("fb-company").value = "";
                    document.getElementById("fb-comment").value = "";
                    document.querySelectorAll(".fb-status-btn").forEach(function (b) { b.dataset.selected = "false"; });
                    selectedStatus = null;
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Submit Feedback";
                    loadFeedback();
                })
                .catch(function (err) {
                    errEl.textContent = "Something went wrong. Please try again.";
                    errEl.style.display = "block";
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Submit Feedback";
                });
        });

        loadFeedback();
    }

    function loadFeedback() {
        fetch(API + "?document_slug=eq." + slug + "&order=created_at.desc", {
            headers: { apikey: cfg.supabaseKey, Authorization: "Bearer " + cfg.supabaseKey }
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var list = document.getElementById("fb-list");
                var countEl = document.getElementById("fb-count");
                countEl.textContent = data.length > 0 ? "(" + data.length + ")" : "";

                if (!data.length) {
                    list.innerHTML = '<div class="fb-empty">No feedback yet. Be the first to review this document.</div>';
                    return;
                }

                list.innerHTML = data.map(function (item) {
                    var meta = STATUS_META[item.status];
                    return '<div class="fb-item">' +
                        '<div class="fb-item-header">' +
                        '<span class="fb-reviewer">' + esc(item.reviewer_name) + '</span>' +
                        (item.reviewer_company ? '<span class="fb-company">' + esc(item.reviewer_company) + '</span>' : '') +
                        '<span class="fb-status-badge" style="background:' + meta.bg + ';color:' + meta.color + '">' + meta.icon + ' ' + meta.label + '</span>' +
                        '<span class="fb-time">' + timeAgo(item.created_at) + '</span>' +
                        '</div>' +
                        '<div class="fb-comment">' + esc(item.comment) + '</div>' +
                        '</div>';
                }).join("");
            })
            .catch(function () {});
    }

    function esc(s) {
        var d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildWidget);
    } else {
        buildWidget();
    }
})();
