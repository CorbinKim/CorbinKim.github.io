// First screen: paste a fine-grained GitHub token once.
import {h} from "../dom.js";
import {DRAFTS_REPO, REPO} from "../config.js";
import {tokenCreationUrl} from "../github.js";
import {MIN_PASSWORD_LENGTH, passwordProblem} from "../vault.js";
import {topBar, brandLink} from "../ui.js";

export function connectView(ctx) {
  const error = h("p", {class: "error", role: "alert", hidden: true});
  const token = h("input", {
    class: "input",
    id: "token",
    type: "password",
    name: "token",
    autocomplete: "off",
    placeholder: "github_pat_…",
    required: true,
    spellcheck: false,
    autocapitalize: "off",
    autocorrect: "off"
  });
  const keep = h("input", {type: "checkbox", id: "keep"});
  const password = h("input", {
    class: "input",
    id: "new-password",
    type: "password",
    name: "new-password",
    // Safari offers to generate / remember it in iCloud Keychain
    autocomplete: "new-password",
    spellcheck: false,
    autocapitalize: "off",
    autocorrect: "off"
  });
  const repeat = h("input", {
    class: "input",
    id: "repeat-password",
    type: "password",
    name: "repeat-password",
    autocomplete: "new-password",
    spellcheck: false,
    autocapitalize: "off",
    autocorrect: "off"
  });
  const passwordBlock = h(
    "div",
    {class: "form hidden", id: "password-block"},
    h(
      "p",
      {class: "muted small"},
      "Choose a password of your own (at least ",
      String(MIN_PASSWORD_LENGTH),
      " characters; a short phrase works well). It is not your GitHub password: it only unlocks the token saved on this device, and it is never stored or sent anywhere."
    ),
    h(
      "label",
      {class: "field", for: "new-password"},
      h("span", null, "Password"),
      password
    ),
    h(
      "label",
      {class: "field", for: "repeat-password"},
      h("span", null, "Repeat password"),
      repeat
    )
  );
  keep.addEventListener("change", () => {
    passwordBlock.classList.toggle("hidden", !keep.checked);
    password.required = repeat.required = keep.checked;
  });
  const submit = h(
    "button",
    {class: "btn btn-primary", type: "submit"},
    "Connect"
  );

  const form = h(
    "form",
    {
      class: "form",
      autocomplete: "on",
      onsubmit: async e => {
        e.preventDefault();
        const fail = message => {
          error.textContent = message;
          error.hidden = false;
          submit.disabled = false;
          submit.textContent = "Connect";
        };
        error.hidden = true;
        let pw = "";
        if (keep.checked) {
          pw = password.value;
          const problem = passwordProblem(pw);
          if (problem) return fail(problem);
          if (pw !== repeat.value)
            return fail("The two passwords do not match.");
        }
        submit.disabled = true;
        submit.textContent = keep.checked
          ? "Checking and locking…"
          : "Checking…";
        try {
          await ctx.connect(token.value.trim(), {password: pw});
        } catch (err) {
          fail(err.message || String(err));
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
      {class: "field", for: "token"},
      h("span", null, "Access token"),
      token
    ),
    h(
      "label",
      {class: "check", for: "keep"},
      keep,
      h(
        "span",
        null,
        "Keep me signed in on this device. The token is saved here, locked with a password you choose. Without this it is forgotten when you close the tab."
      )
    ),
    passwordBlock,
    error,
    h("div", null, submit)
  );

  const tokenUrl = tokenCreationUrl({
    owner: REPO.owner,
    repo: REPO.repo,
    days: 90
  });

  const el = h(
    "div",
    null,
    topBar({left: brandLink()}),
    h(
      "main",
      {class: "page page-narrow"},
      h("h1", null, "Write"),
      h(
        "p",
        {class: "lede"},
        "Connect GitHub once and publish from here. Your token stays in this browser and is only ever sent to api.github.com. After the first time you can unlock it with a password of your own."
      ),
      form,
      h(
        "details",
        {class: "howto", open: true},
        h("summary", null, "How to create the token"),
        h(
          "ol",
          {class: "steps"},
          h(
            "li",
            null,
            h(
              "a",
              {href: tokenUrl, target: "_blank", rel: "noopener noreferrer"},
              "Open GitHub's new-token form"
            ),
            " (name, 90-day expiry and Contents permission are pre-filled)."
          ),
          h(
            "li",
            null,
            "Under ",
            h("strong", null, "Repository access"),
            " choose ",
            h("strong", null, "Only select repositories"),
            " and pick ",
            h("strong", null, `${REPO.owner}/${REPO.repo}`),
            ". Optional, to continue drafts on other devices: also pick your private ",
            h("strong", null, `${DRAFTS_REPO.owner}/${DRAFTS_REPO.repo}`),
            " repository (see docs/draft-sync.md)."
          ),
          h(
            "li",
            null,
            "Check that ",
            h("strong", null, "Contents"),
            " is ",
            h("strong", null, "Read and write"),
            ". Nothing else is needed."
          ),
          h("li", null, "Generate the token, copy it, and paste it above.")
        )
      )
    )
  );
  return {el, destroy() {}};
}
