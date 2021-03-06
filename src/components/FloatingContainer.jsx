import React from "react";
import { $, $$ } from "../utils/index";

const transitionStandard = "1.15s ease-out";
const transitionSmooth = "2.15s ease-in-out";
const floatArticleEvent = new Event("floatarticle", { bubbles: true });

const runTask = (thing, fn) => {
  if (thing.forEach) thing.forEach(obj => runTask(obj, fn));
  fn(thing);
};

const changeOpacity = (obj, value) =>
  runTask(obj, element => {
    const a = element
    a.style.opacity = value;
  });

const findALinkParent = x =>
  x.nodeName === "A" ? x : findALinkParent(x.parentNode);

const floatingElementDestroy = () => {
  // avoids a flick caused by smooth scrolling when article is destroyed
  const avoidScrollBehaviorSmooth = () => {
    const sb = getComputedStyle(document.body).scrollBehavior;
    if (!sb) return;
    if (sb !== "auto") document.body.style.scrollBehavior = "auto";
  };
  const enableDisabledLinks = () => {
    [...$$("a.disabled")].forEach(link => {
      link.classList.remove("disabled");
    });
  };
  const positionFixedRemove = () => {
    const m = $("#main");
    [...m.children].forEach(child => child.removeAttribute("style"));
  };
  const el = $(".added-by-js");

  el.style.transition = `opacity ${transitionStandard}`;
  changeOpacity(el, 0);
  el.addEventListener(
    "transitionend",
    () => {
      el.classList.remove("added-by-js");
      el.classList.add("hide");
      el.removeAttribute("style");
      $$(".empty-transparency").forEach(transp => el.removeChild(transp));
      enableDisabledLinks();
      avoidScrollBehaviorSmooth();
      positionFixedRemove();
      // avoid flicks by cancelling some scrolling
      window.scroll(0, Number.parseInt(el.dataset.top, 10));
      // cleanup js css
      document.body.removeAttribute("style");
    },
    { once: true }
  );

  window.removeEventListener("scroll", scrollHandler);
  window.removeEventListener("keydown", keyHandler);
};

const floatingElementInsert = e => {
  // if the hashChecker() called this, e will be a string
  const triggeredByClick = typeof e === "object";
  // get the link that was clicked or URL hash navigated to and figure what article to show
  const targetHash = triggeredByClick
    ? findALinkParent(e.target).attributes.href.value
    : e;
  const el = $(targetHash);
  // see BUG below
  const tail = document.createElement("div");
  const m = document.querySelector("#main");

  const headPrepender = () => {
    const head = document.createElement("div");
    head.classList.add("empty-transparency");
    head.style.height = `${el.dataset.top}px`;
    head.style.top = `${-1 * Number.parseInt(el.dataset.top, 10)}px`;
    el.prepend(head);
    head.addEventListener("click", floatingElementDestroy, { once: true });
    head.addEventListener("touchend", floatingElementDestroy, {
      once: true
    });
  };
  const tailAppender = () => {
    el.appendChild(tail);
    tail.classList.add("empty-transparency");
    tail.style.top = `${el.offsetHeight}px`;
    tail.addEventListener("click", floatingElementDestroy, { once: true });
    tail.addEventListener("touchend", floatingElementDestroy, {
      once: true
    });
  };
  const unsetProgressCursor = () => {
    document.body.style.cursor = "auto";
  };
  // setting this too early causes scroll that interferes with the floating transition
  const setURLHash = () => {
    if (window.location.hash !== targetHash) window.location.hash = targetHash;
  };

  // set cursor for feedback something is gonna happen
  document.body.style.cursor = "progress";

  el.classList.add("added-by-js");
  // in case of a direct navigation to the article, no transition
  el.style.transition = triggeredByClick ? `transform ${transitionSmooth}` : "";
  // move article underneath viewport
  el.style.top = `${window.innerHeight + window.scrollY}px`;
  el.classList.remove("hide");
  // hide nonsensical link if js works
  el.querySelector('.container-backlinks a.back[href="#header"]').classList.add(
    "hide"
  );

  // BUG: Safari needs this line outside 'load' handler below
  tail.style.top = `${el.offsetHeight}px`;

  // article specific functions listen to this
  el.dispatchEvent(floatArticleEvent);

  // the point where the article begins
  el.setAttribute("data-top", window.scrollY);
  // trigger to bring article up
  el.style.transform = `translateY(-${window.innerHeight}px)`;
  // .main scrolls away with the article and the body's bg color looks like a glitch
  document.body.style.backgroundColor = getComputedStyle(m).backgroundColor;

  // if done earlier it will have wrong height
  if (document.readyState === "complete") tailAppender();
  else window.addEventListener("load", tailAppender, { once: true });

  if (triggeredByClick) {
    // will run after transition and wrap it up
    el.addEventListener("transitionend", positionFixedApply, { once: true });
    el.addEventListener("transitionend", headPrepender, { once: true });
    el.addEventListener("transitionend", unsetProgressCursor, { once: true });
    el.addEventListener("transitionend", setURLHash, { once: true });
  } else {
    // if no transiton, do immediately
    positionFixedApply();
    headPrepender();
    unsetProgressCursor();
    setURLHash();
  }

  // events to close the floating article
  el.querySelector("a.close").addEventListener(
    "click",
    floatingElementDestroy,
    { once: true }
  );
  el.querySelector("a.close").addEventListener(
    "touchend",
    floatingElementDestroy,
    { once: true }
  );

  window.addEventListener("scroll", scrollHandler, { passive: true });
  window.addEventListener("keydown", keyHandler);
};

const applyOnInternalLinks = (selector, fn) => {
  const internals = [...$$(selector)].filter(
    link => !link.classList.contains("other-site")
  );
  return fn ? internals.forEach(fn) : internals;
};

const addFloatingHandler = selector => {
  const handler = e => {
    if ($(".added-by-js")) return;
    e.preventDefault();
    floatingElementInsert(e);
    applyOnInternalLinks(selector, link => link.classList.add("disabled"));
  };

  applyOnInternalLinks(selector, link =>
    link.addEventListener("click", handler)
  );
};

const positionFixedApply = () => {
  const m = $("#main");
  const el = $(".added-by-js");

  const mchildren = [...m.children].filter(
    child =>
      child.attributes.id === undefined ||
      (child.attributes.id.value !== "reads" &&
        child.attributes.id.value !== "projects")
  );

  // reverse to start from bottom, because elements tend to collapse upwards
  mchildren.reverse();
  mchildren.forEach(child => {
    const c = child;
    c.style.top = `${c.offsetTop - Number.parseInt(el.dataset.top, 10)}px`;
    c.style.position = "fixed";
  });
};

const scrollHandler = e => {
  // ignore scroll up, but firefox only, I think
  if (e.deltaY < 0) return;
  const el = $(".added-by-js");

  if (
    el &&
    window.scrollY >=
      el.offsetHeight + Number.parseInt(el.dataset.top, 10) - 120
  )
    floatingElementDestroy();
};

const keyHandler = e => {
  if (
    e.key !== " " &&
    e.key !== "PageDown" &&
    e.key !== "Escape" &&
    e.key !== "ArrowDown"
  )
    return;

  if (e.key === "Escape") floatingElementDestroy();
  else scrollHandler(e);
};

class FloatingContainer extends React.Component {
  componentDidMount() {
    addFloatingHandler(`.${this.props.selector}-preview a`);
  }

  render() {
    return <React.Fragment>{this.props.children}</React.Fragment>;
  }
}

export default FloatingContainer;
