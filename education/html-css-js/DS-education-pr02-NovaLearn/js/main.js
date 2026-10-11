import { initNav } from "./modules/nav.js";
import { initAccordion } from "./modules/accordion.js";
import { initCourseFilters } from "./modules/course-filters.js";
import { initFormValidation } from "./modules/form-validate.js";

document.documentElement.classList.remove("no-js");
document.documentElement.classList.add("js");

initNav();
initAccordion();
initCourseFilters();
initFormValidation();
