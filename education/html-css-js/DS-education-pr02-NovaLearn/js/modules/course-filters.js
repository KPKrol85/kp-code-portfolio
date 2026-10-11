export function initCourseFilters() {
  const filterForm = document.querySelector("[data-course-filter]");
  const courseCards = document.querySelectorAll("[data-course-card]");

  if (!filterForm || !courseCards.length) {
    return;
  }

  const searchInput = filterForm.querySelector("[data-course-search]");
  const categorySelect = filterForm.querySelector("[data-course-category]");
  const levelSelect = filterForm.querySelector("[data-course-level]");
  const resultCount = document.querySelector("[data-course-count]");

  const filterCourses = () => {
    const searchValue = searchInput.value.toLowerCase();
    const categoryValue = categorySelect.value;
    const levelValue = levelSelect.value;
    let visibleCount = 0;

    courseCards.forEach((card) => {
      const matchesSearch = card.dataset.title.toLowerCase().includes(searchValue);
      const matchesCategory = categoryValue === "all" || card.dataset.category === categoryValue;
      const matchesLevel = levelValue === "all" || card.dataset.level === levelValue;
      const shouldShow = matchesSearch && matchesCategory && matchesLevel;

      card.hidden = !shouldShow;
      if (shouldShow) {
        visibleCount += 1;
      }
    });

    if (resultCount) {
      resultCount.textContent = `${visibleCount} programs shown`;
    }
  };

  filterForm.addEventListener("input", filterCourses);
  filterForm.addEventListener("change", filterCourses);

  filterCourses();
}
