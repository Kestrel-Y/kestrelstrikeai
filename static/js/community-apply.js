(function () {
  "use strict";

  var GH_REPO = "https://github.com/Kestrel-Y/kestrelstrikeai";
  var TEMPLATES = {
    enterprise: "trial-enterprise.yml",
    redteam: "trial-redteam.yml",
    whitehat: "trial-whitehat.yml",
    reverser: "trial-reverser.yml",
    other: "trial-other.yml",
  };

  function roleLabel(role) {
    switch (role) {
      case "enterprise":
        return "企业安全团队";
      case "redteam":
        return "个人红队师傅";
      case "whitehat":
        return "白帽子";
      case "reverser":
        return "逆向研究人员";
      default:
        return "其他";
    }
  }

  function editionLabel(edition) {
    switch (edition) {
      case "pro":
        return "正式版咨询";
      case "enterprise":
        return "企业版咨询";
      default:
        return "试用版";
    }
  }

  function buildBody(data) {
    return [
      "### 申请角色",
      roleLabel(data.role),
      "",
      "### 期望授权版本",
      editionLabel(data.edition) + " (`" + data.edition + "`)",
      "",
      "### 姓名 / 代号",
      data.name,
      "",
      "### 单位 / 组织",
      data.org || "（未填写）",
      "",
      "### 联系方式",
      data.contact,
      "",
      "### 实例指纹 / 激活请求",
      data.fingerprint || "（未填写 — 部署后可从 /activate 导出）",
      "",
      "### 用途说明",
      data.purpose,
      "",
      "### 授权承诺",
      data.authorize
        ? "已勾选：仅在已获书面授权场景使用，并同意免责与安全声明。"
        : "未勾选",
      "",
      "---",
      "_由社区站试用激活申请表单预填_",
    ].join("\n");
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var form = ev.target;
    var fd = new FormData(form);
    var role = String(fd.get("role") || "");
    var edition = String(fd.get("edition") || "trial");
    var name = String(fd.get("name") || "").trim();
    var org = String(fd.get("org") || "").trim();
    var contact = String(fd.get("contact") || "").trim();
    var fingerprint = String(fd.get("fingerprint") || "").trim();
    var purpose = String(fd.get("purpose") || "").trim();
    var authorize = fd.get("authorize") === "yes";

    if (!TEMPLATES[role]) {
      alert("请选择申请角色");
      return;
    }
    if (role === "enterprise" && !org) {
      alert("企业申请请填写单位 / 组织");
      return;
    }
    if (!name || !contact || !purpose) {
      alert("请填写姓名/代号、联系方式与用途说明");
      return;
    }
    if (!authorize) {
      alert("请先勾选授权承诺");
      return;
    }

    var title =
      "试用激活申请 · " +
      editionLabel(edition) +
      " · " +
      roleLabel(role) +
      " · " +
      name;
    var body = buildBody({
      role: role,
      edition: edition,
      name: name,
      org: org,
      contact: contact,
      fingerprint: fingerprint,
      purpose: purpose,
      authorize: authorize,
    });
    var url =
      GH_REPO +
      "/issues/new?template=" +
      encodeURIComponent(TEMPLATES[role]) +
      "&title=" +
      encodeURIComponent(title) +
      "&body=" +
      encodeURIComponent(body);
    window.open(url, "_blank", "noopener");
  }

  function ready() {
    var form = document.getElementById("ksApplyForm");
    if (form) form.addEventListener("submit", onSubmit);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
