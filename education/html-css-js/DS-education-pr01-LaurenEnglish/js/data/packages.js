export const PACKAGE_KEYS = Object.freeze(["start", "regular", "intensive"]);

export const packages = Object.freeze({
  start: Object.freeze({
    key: "start",
    label: "Start",
    comparisonLabel: "SPOKOJNY START",
    isHighlighted: false,
    href: "/pakiety.html#pakiet-start",
    summary: "Rytm: regularne spotkania w miesiącu.",
    priceLabel: null,
    benefits: Object.freeze([
      "Plan dopasowany do poziomu i celu.",
      "Podstawowe materiały po lekcjach.",
      "Krótkie podsumowania i kolejny krok.",
    ]),
    audience:
      "Dla osób, które chcą wrócić do nauki lub uporządkować podstawy bez nadmiernego tempa.",
    cta: Object.freeze({
      label: "Zapytaj o pakiet Start",
      href: "/kontakt.html#formularz",
    }),
  }),
  regular: Object.freeze({
    key: "regular",
    label: "Regular",
    comparisonLabel: "STAŁA REGULARNOŚĆ",
    isHighlighted: true,
    href: "/pakiety.html#pakiet-regular",
    homeTeaser: Object.freeze({
      description:
        "Dla osób, które chcą uczyć się systematycznie, utrzymać motywację i rozwijać umiejętności krok po kroku.",
      benefits: Object.freeze([
        "Stałe spotkania w ustalonym rytmie.",
        "Materiały i krótkie zadania między lekcjami.",
        "Regularne podsumowania postępów.",
      ]),
    }),
    summary: "Rytm: stałe spotkania w tygodniu.",
    priceLabel: null,
    benefits: Object.freeze([
      "Plan tematyczny na kilka tygodni.",
      "Rozszerzone materiały i zadania między lekcjami.",
      "Regularne podsumowania postępów.",
    ]),
    audience:
      "Dla osób, które chcą pracować systematycznie i rozwijać angielski w stabilnym rytmie.",
    cta: Object.freeze({
      label: "Zapytaj o pakiet Regular",
      href: "/kontakt.html#formularz",
    }),
  }),
  intensive: Object.freeze({
    key: "intensive",
    label: "Intensive",
    comparisonLabel: "INTENSYWNY CEL",
    isHighlighted: false,
    href: "/pakiety.html#pakiet-intensive",
    summary: "Rytm: częstsze spotkania i szybsza informacja zwrotna.",
    priceLabel: null,
    benefits: Object.freeze([
      "Priorytetowy plan działania.",
      "Rozszerzone materiały i próby egzaminacyjne.",
      "Częstsza korekta oraz wsparcie między lekcjami.",
    ]),
    audience:
      "Dla osób przygotowujących się do egzaminu, ważnego projektu lub konkretnego terminu.",
    cta: Object.freeze({
      label: "Zapytaj o pakiet Intensive",
      href: "/kontakt.html#formularz",
    }),
  }),
});

export const packageList = Object.freeze(
  PACKAGE_KEYS.map((key) => packages[key]),
);

export const packagesSectionHref = "/pakiety.html#pakiety";
export const packagesPageHref = "/pakiety.html";
