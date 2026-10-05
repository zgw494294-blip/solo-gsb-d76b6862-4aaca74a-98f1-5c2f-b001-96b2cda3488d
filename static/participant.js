"use strict";

const token = location.pathname.split("/").filter(Boolean)[1];

const els = {
  name: document.getElementById("my-name"),
  version: document.getElementById("my-version"),
  manuscript: document.getElementById("my-manuscript"),
  saveMs: document.getElementById("save-manuscript"),
  msMsg: document.getElementById("ms-msg"),
  assignment: document.getElementById("assignment"),
  assignmentVersion: document.getElementById("assignment-version"),
  assignmentNotice: document.getElementById("assignment-notice"),
  reviewStatus: document.getElementById("review-status"),
  review: document.getElementById("my-review"),
  submitReview: document.getElementById("submit-review"),
  reviewMsg: document.getElementById("review-msg"),
  publishedBanner: document.getElementById("published-banner"),
  receivedSection: document.getElementById("received-section"),
  received: document.getElementById("received"),
  questionSection: document.getElementById("question-section"),
  questionQa: document.getElementById("received-qa"),
  questionInput: document.getElementById("question-input"),
  submitQuestion: document.getElementById("submit-question"),
  questionMsg: document.getElementById("question-msg"),
  answerSection: document.getElementById("answer-section"),
  answerQa: document.getElementById("answer-qa"),
  answerInput: document.getElementById("answer-input"),
  submitAnswer: document.getElementById("submit-answer"),
  answerMsg: document.getElementById("answer-msg"),
};

let firstLoad = true;
let assignmentVersionShown = null; // 当前页面展示的（也是提交时绑定的）稿件版本

function setMsg(el, text, isError) {
  el.textContent = text || "";
  el.className = isError ? "error" : "ok";
}

function qaBlock(role, text) {
  const div = document.createElement("div");
  div.className = "qa-entry";
  const label = document.createElement("p");
  label.className = "muted";
  label.textContent = role;
  const body = document.createElement("p");
  body.textContent = text;
  div.append(label, body);
  return div;
}

// 渲染一问一答：仅重绘只读展示区，绝不触碰输入框，避免轮询覆盖正在输入的内容
function renderQa(container, qa, questionLabel, answerLabel) {
  container.textContent = "";
  if (!qa) return;
  if (qa.question) container.appendChild(qaBlock(questionLabel, qa.question));
  if (qa.answer) container.appendChild(qaBlock(answerLabel, qa.answer));
}

async function refresh() {
  let s;
  try {
    const r = await fetch("/api/p/" + token);
    const data = await r.json();
    if (!r.ok) {
      document.getElementById("content").hidden = true;
      const fatal = document.getElementById("fatal");
      fatal.hidden = false;
      fatal.textContent = data.error || "个人链接无效";
      return;
    }
    s = data;
  } catch {
    return; // 网络抖动，下次轮询再试
  }
  render(s);
}

function render(s) {
  els.name.textContent = s.name;
  els.version.textContent = "v" + s.version;

  // 只有自己能改自己的稿，首次载入填充即可，避免轮询覆盖正在输入的内容
  if (firstLoad) {
    els.manuscript.value = s.manuscript;
    if (s.my_review) els.review.value = s.my_review.content;
  }

  // 被分配的稿件：版本变化时刷新展示并提示重新阅读
  if (assignmentVersionShown !== s.assignment.version) {
    const hadOld = assignmentVersionShown !== null;
    assignmentVersionShown = s.assignment.version;
    els.assignment.textContent = s.assignment.manuscript;
    els.assignmentVersion.textContent = "v" + s.assignment.version;
    els.assignmentNotice.hidden = !(hadOld && !s.published);
  }

  // 我的意见状态
  if (!s.my_review) {
    els.reviewStatus.textContent = "尚未提交意见。";
    els.reviewStatus.className = "muted";
  } else if (s.my_review.valid) {
    els.reviewStatus.textContent = "已提交（对应稿件 v" + s.my_review.version + "，当前有效，可修改后重新提交）。";
    els.reviewStatus.className = "ok";
  } else {
    els.reviewStatus.textContent =
      "你提交的意见（对应稿件 v" + s.my_review.version +
      "）已因稿件更新而失效，请阅读最新稿件后重新提交。";
    els.reviewStatus.className = "pending";
  }

  // 公布后锁定一切编辑，并展示收到的匿名意见
  if (s.published) {
    els.publishedBanner.hidden = false;
    els.assignmentNotice.hidden = true;
    els.manuscript.disabled = true;
    els.saveMs.disabled = true;
    els.review.disabled = true;
    els.submitReview.disabled = true;
    els.receivedSection.hidden = false;
    els.received.textContent = s.received !== null ? s.received : "（无）";

    // 作者侧：对收到的匿名意见一次一问一答
    const q = s.received_qa;
    renderQa(els.questionQa, q, "我的问题：", "评审者答复：");
    if (q) {
      els.questionInput.disabled = true;
      els.submitQuestion.disabled = true;
      els.questionInput.placeholder =
        q.answer !== null ? "一问一答已结束。" : "问题已提交，等待评审者答复。";
    }

    // 评审者侧：仅当作者就我的意见发起提问时显示问答区
    const a = s.my_review_qa;
    if (a) {
      els.answerSection.hidden = false;
      renderQa(els.answerQa, a, "作者的问题：", "我的答复：");
      if (a.answer !== null) {
        els.answerInput.disabled = true;
        els.submitAnswer.disabled = true;
        els.answerInput.placeholder = "已答复，一问一答结束。";
      }
    }
  }

  firstLoad = false;
}

async function postQa(path, text, inputEl, btnEl, msgEl, okText) {
  setMsg(msgEl, "");
  btnEl.disabled = true;
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    const data = await r.json();
    if (!r.ok) {
      setMsg(msgEl, data.error || "提交失败", true);
      btnEl.disabled = false;
      return;
    }
    setMsg(msgEl, okText);
    inputEl.disabled = true;
  } catch {
    setMsg(msgEl, "网络错误，请重试", true);
    btnEl.disabled = false;
  }
  refresh();
}

els.saveMs.addEventListener("click", async () => {
  setMsg(els.msMsg, "");
  try {
    const r = await fetch("/api/p/" + token + "/manuscript", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manuscript: els.manuscript.value }),
    });
    const data = await r.json();
    if (!r.ok) {
      setMsg(els.msMsg, data.error || "保存失败", true);
    } else {
      setMsg(els.msMsg, "已保存为 v" + data.version + "，针对你稿件的已交意见已失效。");
    }
  } catch {
    setMsg(els.msMsg, "网络错误，请重试", true);
  }
  refresh();
});

els.submitReview.addEventListener("click", async () => {
  setMsg(els.reviewMsg, "");
  try {
    const r = await fetch("/api/p/" + token + "/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: els.review.value,
        version: assignmentVersionShown, // 绑定当前读到的稿件版本
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setMsg(els.reviewMsg, data.error || "提交失败", true);
    } else {
      setMsg(els.reviewMsg, "意见已提交。");
      els.assignmentNotice.hidden = true;
    }
  } catch {
    setMsg(els.reviewMsg, "网络错误，请重试", true);
  }
  refresh();
});

els.submitQuestion.addEventListener("click", () => {
  postQa(
    "/api/p/" + token + "/question",
    els.questionInput.value,
    els.questionInput,
    els.submitQuestion,
    els.questionMsg,
    "问题已提交，等待评审者答复。"
  );
});

els.submitAnswer.addEventListener("click", () => {
  postQa(
    "/api/p/" + token + "/answer",
    els.answerInput.value,
    els.answerInput,
    els.submitAnswer,
    els.answerMsg,
    "答复已提交，一问一答结束。"
  );
});

refresh();
setInterval(refresh, 5000);
