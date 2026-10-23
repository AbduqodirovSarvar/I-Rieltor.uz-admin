import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { Page } from '../../core/http/response-model';

export type Category = components['schemas']['PropertyCategoryViewModel'];

export interface CategoryInput {
  name: string;
  description: string;
  parentCategoryId: string | null;
  sortOrder: number;
}

export interface CategoryNode {
  category: Category;
  depth: number;
}

const PAGE = 100;

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly api = inject(ApiClient);

  /** Every category (they are few), all pages. */
  all(): Observable<Category[]> {
    const page = (index: number): Observable<Page<Category>> =>
      this.api.getPage<Category>('api/PropertyCategory/list', {
        pageIndex: index,
        pageSize: PAGE,
        sortBy: 'SortOrder',
        sortDirection: 'asc',
      });
    return page(0).pipe(
      expand((current) =>
        (current.pageIndex + 1) * PAGE < current.totalCount ? page(current.pageIndex + 1) : EMPTY,
      ),
      map((current) => current.items),
      reduce((all, items) => [...all, ...items], [] as Category[]),
    );
  }

  create(input: CategoryInput): Observable<Category> {
    return this.api.postForm<Category>('api/PropertyCategory', this.form(input));
  }

  update(id: string, input: CategoryInput): Observable<Category> {
    const form = this.form(input);
    form.append('Id', id);
    return this.api.putForm<Category>('api/PropertyCategory', form);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/PropertyCategory', { id });
  }

  private form(input: CategoryInput): FormData {
    const form = new FormData();
    form.append('Name', input.name);
    form.append('SortOrder', String(input.sortOrder));
    if (input.description) form.append('Description', input.description);
    if (input.parentCategoryId) form.append('ParentCategoryId', input.parentCategoryId);
    return form;
  }
}

/** The categories as an indented list: children follow their parent, each level in `sortOrder`, then by name. */
export function toTree(categories: readonly Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  const ids = new Set(categories.map((c) => c.id));
  for (const category of categories) {
    // A category whose parent is missing from the list is shown at the top, not lost.
    const parent =
      category.parentCategoryId && ids.has(category.parentCategoryId)
        ? category.parentCategoryId
        : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), category]);
  }
  const order = (a: Category, b: Category) =>
    a.sortOrder - b.sortOrder || (a.name ?? '').localeCompare(b.name ?? '', 'uz');
  const result: CategoryNode[] = [];
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const category of (byParent.get(parent) ?? []).sort(order)) {
      if (seen.has(category.id)) continue; // a cycle would otherwise never end
      result.push({ category, depth });
      walk(category.id, depth + 1, new Set(seen).add(category.id));
    }
  };
  walk(null, 0, new Set());
  return result;
}

/** The ids of a category and everything below it (a category cannot become its own descendant's child). */
export function descendantIds(categories: readonly Category[], id: string): Set<string> {
  const found = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of categories) {
      if (
        category.parentCategoryId &&
        found.has(category.parentCategoryId) &&
        !found.has(category.id)
      ) {
        found.add(category.id);
        grew = true;
      }
    }
  }
  return found;
}
