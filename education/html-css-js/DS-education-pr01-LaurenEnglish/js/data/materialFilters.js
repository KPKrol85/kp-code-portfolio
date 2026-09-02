export const filterMaterials = (items, filters = {}) => {
  const {
    category = "all",
    level = "all",
    format = "all",
    access = "all",
  } = filters;

  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;

    if (level !== "all") {
      const matchesLevel =
        level === "All"
          ? item.level === "All"
          : item.level === level || item.level === "All";
      if (!matchesLevel) return false;
    }

    if (format !== "all" && item.format !== format) return false;
    if (access !== "all" && item.access !== access) return false;

    return true;
  });
};
