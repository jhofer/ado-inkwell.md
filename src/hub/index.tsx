import React from "react";
import ReactDOM from "react-dom";
import { Hub } from "./hub";

const el = document.getElementById("app");
if (el) {
  el.classList.remove("loading");
  ReactDOM.render(<Hub />, el);
}
