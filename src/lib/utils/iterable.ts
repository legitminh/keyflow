export function insert_sorted<T>(arr: T[], item: T, compare: (a: T, b: T) => number) {
  let lo = 0;
  let hi = arr.length;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);

    if (compare(arr[mid], item) < 0) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  arr.splice(lo, 0, item);

  return arr;
}
