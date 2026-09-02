import { packages } from "./packages.js";

const CONTACT_HREF = "/index.html#contact";
const DEFAULT_UNAVAILABLE_LABEL = "Materiał w przygotowaniu";

const isUsableHref = (href) =>
  typeof href === "string" && href.trim() !== "" && href.trim() !== "#";

const unavailableAction = ({
  label = DEFAULT_UNAVAILABLE_LABEL,
  reason,
  isValid,
}) => ({
  kind: "informational",
  label,
  href: null,
  buttonClass: null,
  isValid,
  reason,
});

export const resolveMaterialAction = (item) => {
  const action = item?.action;
  if (!action || typeof action !== "object") {
    return unavailableAction({
      isValid: false,
      reason: "missing-action",
    });
  }

  if (action.type === "unavailable") {
    return unavailableAction({
      label: action.label,
      isValid: typeof action.label === "string" && action.label.trim() !== "",
      reason: "intentionally-unavailable",
    });
  }

  if (action.type === "package") {
    const packageRecord = packages[item.packageKey];
    if (!packageRecord || !isUsableHref(packageRecord.href)) {
      return unavailableAction({
        isValid: false,
        reason: "invalid-package-route",
      });
    }

    return {
      kind: "link",
      label: `${action.label} ${packageRecord.label}`,
      href: packageRecord.href,
      buttonClass: "button--secondary",
      isValid: typeof action.label === "string" && action.label.trim() !== "",
      reason: "package-route",
      packageKey: packageRecord.key,
    };
  }

  if (action.type === "contact") {
    const href = action.href || CONTACT_HREF;
    if (!isUsableHref(href)) {
      return unavailableAction({
        isValid: false,
        reason: "invalid-contact-route",
      });
    }

    return {
      kind: "link",
      label: action.label,
      href,
      buttonClass: "button--secondary",
      isValid: typeof action.label === "string" && action.label.trim() !== "",
      reason: "contact-route",
    };
  }

  if (action.type === "link" && isUsableHref(action.href)) {
    return {
      kind: "link",
      label: action.label,
      href: action.href,
      buttonClass: item.access === "free" ? "button--ghost" : "button--primary",
      isValid: typeof action.label === "string" && action.label.trim() !== "",
      reason: "direct-link",
    };
  }

  return unavailableAction({
    isValid: false,
    reason: "unsupported-action",
  });
};

const categoryLabels = Object.freeze({
  grammar: "Gramatyka",
  vocabulary: "Słownictwo",
  speaking: "Mówienie",
  writing: "Pisanie",
  exam: "Egzaminy",
  business: "Biznes",
});

const accessLabels = Object.freeze({
  free: "Bezpłatny",
  premium: "Premium",
});

const homeAccessLabels = Object.freeze({
  free: "Bezpłatny",
  premium: "Premium",
});

const formatLabels = Object.freeze({
  Worksheet: "Karta pracy",
  Video: "Wideo",
});

const getHomeActionPresentation = (action) => {
  if (action.kind === "informational") {
    return { ...action, label: "Materiał w przygotowaniu" };
  }

  const packageLabel = packages[action.packageKey]?.label;
  if (action.kind === "link" && packageLabel) {
    return { ...action, label: `Sprawdź pakiet ${packageLabel}` };
  }

  return action;
};

export const getMaterialPresentation = (item, { surface = "catalog" } = {}) => {
  const isHomeTeaser = surface === "home";
  const action = resolveMaterialAction(item);

  return {
    categoryLabel: categoryLabels[item.category] || item.category,
    levelLabel: item.level === "All" ? "Wszystkie poziomy" : item.level,
    formatLabel: formatLabels[item.format] || item.format,
    accessLabel:
      (isHomeTeaser ? homeAccessLabels : accessLabels)[item.access] ||
      item.access,
    action: isHomeTeaser ? getHomeActionPresentation(action) : action,
  };
};
