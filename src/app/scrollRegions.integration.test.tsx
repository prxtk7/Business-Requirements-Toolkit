import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderApp';

/** Pages whose data table can be wider than the screen, with the table and region names. */
const SCROLLABLE_TABLES = [
  { path: '/stakeholders', table: 'Stakeholder register', region: 'Stakeholder register table' },
  { path: '/requirements', table: 'Requirements', region: 'Requirements table' },
  { path: '/user-stories', table: 'User stories', region: 'User stories table' },
  { path: '/coverage', table: 'Requirement coverage', region: 'Requirement coverage table' },
  { path: '/risks', table: 'Risks', region: 'Risks table' },
];

describe('horizontally scrollable tables', () => {
  it.each(SCROLLABLE_TABLES)('$path: the table sits in a named, keyboard-focusable scroll region', async ({ path, table, region }) => {
    const { user } = renderApp({ path });

    const scrollRegion = await screen.findByRole('region', { name: region });
    expect(within(scrollRegion).getByRole('table', { name: table })).toBeInTheDocument();
    expect(scrollRegion).toHaveAttribute('tabindex', '0');
    expect(scrollRegion).toHaveClass('overflow-x-auto');

    // Reachable with Tab, so arrow keys can then scroll it.
    scrollRegion.focus();
    expect(scrollRegion).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab();
    expect(scrollRegion).toHaveFocus();
  });
});
