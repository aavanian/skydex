import "./style.css";
import { activitiesFromCar } from "./activities";
import { actorFromInput } from "./actor-input";
import { downloadRepo, resolveAccount } from "./repo";
import { h } from "./ui/dom";
import { renderProfile } from "./ui/profile";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app element");

const input = h("input", {
  type: "text",
  name: "actor",
  placeholder: "Handle, DID or profile URL",
  autocomplete: "off",
  spellcheck: false,
});
const form = h(
  "form",
  { className: "lookup" },
  input,
  h("button", { type: "submit" }, "Analyze"),
);
const status = h("p", { className: "status" });
const results = h("div");

app.replaceChildren(
  h("h1", {}, "Bluesky account profile"),
  form,
  status,
  results,
);

function setStatus(text: string, isError = false) {
  status.textContent = text;
  status.classList.toggle("error", isError);
}

async function analyze(actor: string) {
  results.replaceChildren();
  try {
    setStatus(`Resolving ${actor}…`);
    const account = await resolveAccount(actor);
    setStatus(`Downloading @${account.handle}'s history…`);
    const car = await downloadRepo(account);
    setStatus("Analyzing…");
    const activities = activitiesFromCar(account.did, car);
    setStatus("");
    renderProfile(results, account, activities);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

function analyzeFromInput(text: string) {
  const actor = actorFromInput(text);
  if (!actor) {
    setStatus(`Not a handle, DID or profile URL: ${text}`, true);
    return;
  }
  input.value = actor;
  const url = new URL(location.href);
  url.searchParams.set("actor", actor);
  history.replaceState(null, "", url);
  void analyze(actor);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyzeFromInput(input.value);
});

const initial = new URLSearchParams(location.search).get("actor");
if (initial) analyzeFromInput(initial);
