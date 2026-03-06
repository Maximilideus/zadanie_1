import { useState, useEffect } from "react";
import { fetchCatalogGrouped } from "../api/catalog.js";

/**
 * @param {"laser"|"wax"|"electro"|"massage"} category
 * @returns {{ data: object|null, loading: boolean, error: string|null }}
 */
export function useCatalog(category) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!category) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchCatalogGrouped(category)
      .then(setData)
      .catch((err) => setError(err.message ?? "Failed to load catalog"))
      .finally(() => setLoading(false));
  }, [category]);

  return { data, loading, error };
}
