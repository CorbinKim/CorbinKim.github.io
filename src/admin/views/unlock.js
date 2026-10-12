// Shown when a token is saved on this device (locked with the owner's
// password) but this tab has no session yet.
import {h} from "../dom.js";
import {REPO} from "../config.js";
import {brandLink, topBar} from "../ui.js";

export function unlockView(ctx) {
  const error = h("p", {class: "error", role: "alert", hidden: true});
  const password = h("input", {
    class: "input",
    id: "password",
    type: "password",
    name: "password",
    // Safari can fill this from iCloud Keychain if it saved the password
    autocomplete: "current-password",
    required: true,
    spellcheck: false,
    autocapitalize: "off",
    autocorrect: "off"
  });
  const submit = h(
    "button",
    {class: "btn btn-primary", type: "submit"},
    "Unlock"
  );

  const form = h(
    "form",
    {
      class: "form",
      autocomplete: "on",
      onsubmit: async e => {
        e.preventDefault();
        error.hidden = true;
        submit.disabled = true;
        submit.textContent = "Unlocking…";
        try {
          await ctx.unlock(password.value);
        } catch (err) {
          error.textContent = err.message || String(err);
          error.hidden = false;
          submit.disabled = false;
          submit.textContent = "Unlock";
          if (err.code === "WRONG_PASSWORD") {
            password.select();
            password.focus();
          }
        }
      }
    },
    h(
      "label",
      {class: "field", for: "repo"},
      h("span", null, "Repository"),
      h("input", {
        class: "input",
        id: "repo",
        name: "username",
        autocomplete: "username",
        readOnly: true,
        value: `${REPO.owner}/${REPO.repo}`
      })
    ),
    h(
      "label",
      {class: "field", for: "password"},
      h("span", null, "Password"),
      password
    ),
    error,
    h("div", null, submit)
  );

  const el = h(
    "div",
    null,
    topBar({left: brandLink()}),
    h(
      "main",
      {class: "page page-narrow"},
      h("h1", null, "Unlock"),
      h(
        "p",
        {class: "lede"},
        "Your GitHub token is saved on this device, locked with your password. Enter it to continue."
      ),
      form,
      h(
        "p",
        {class: "muted small", style: "margin-top: 28px"},
        h(
          "button",
          {
            class: "btn btn-quiet",
            type: "button",
            onclick: () => {
              if (
                confirm(
                  "Forget the saved token on this device? You will need to paste a token again. Your drafts are kept."
                )
              )
                ctx.forgetDevice();
            }
          },
          "Use a different token"
        )
      )
    )
  );

  requestAnimationFrame(() => password.focus());
  return {el, destroy() {}};
}
