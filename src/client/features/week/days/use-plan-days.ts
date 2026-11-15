import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { addDays } from "@shared/dates";
import { api, unwrap } from "@/lib/api/api";
import { keys } from "@/lib/api/query";

/** Days loaded per page: two rows of the desktop grid. */
const CHUNK = 14;
/** How far ahead the planning goes: half a year. */
const LIMIT = 182;

const fetchDays = (from: string, days: number) => unwrap(api.plan.days.$get({ query: { from, days: String(days) } }));

/**
 * The planning around `from`, loaded in chunks: the days before it are fetched on demand (`fetchPreviousPage`),
 * the days after it as the list is scrolled. Put `sentinel` on an element at the end of the list: the next chunk
 * loads when it nears the scroll area.
 */
export function usePlanScroll(from: string) {
  const query = useInfiniteQuery({
    queryKey: keys.plan.days(from, "scroll"),
    queryFn: ({ pageParam }) => fetchDays(addDays(from, pageParam), pageParam === -CHUNK ? CHUNK * 2 : CHUNK),
    initialPageParam: -CHUNK,
    getNextPageParam: (_last, _pages, lastOffset) => {
      const next = lastOffset === -CHUNK ? CHUNK : lastOffset + CHUNK;
      return next < LIMIT ? next : undefined;
    },
    getPreviousPageParam: (_first, _pages, firstOffset) => (firstOffset > -LIMIT ? firstOffset - CHUNK : undefined),
  });
  const { isFetching, isFetchNextPageError, hasNextPage, fetchNextPage } = query;
  const sentinel = useRef<HTMLDivElement>(null);
  // observes only while idle: a new observer reports at once, so a sentinel still in view after a chunk loads the next one.
  // A failed chunk stops the loading until the next refresh, instead of retrying in a loop.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || isFetching || isFetchNextPageError || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && fetchNextPage(), {
      root: el.closest("main"),
      rootMargin: "600px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFetching, isFetchNextPageError, hasNextPage, fetchNextPage]);

  return {
    slots: query.data?.pages.flatMap((page) => page.slots),
    hasNextPage,
    sentinel,
    hasPreviousPage: query.hasPreviousPage,
    fetchPreviousPage: query.fetchPreviousPage,
    isFetchingPreviousPage: query.isFetchingPreviousPage,
  };
}
