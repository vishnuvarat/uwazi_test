/* eslint-disable react/no-multi-comp */
import React from 'react';
import { Translate } from 'app/I18N';
import { CellContext, ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { EmbededButton, Button } from 'app/V2/Components/UI';
import { ClientSettingsLinkSchema } from 'app/apiResponseTypes';

const EditButton = ({ cell, column }: CellContext<ClientSettingsLinkSchema, string>) => (
  <Button
    styling="outline"
    onClick={() => column.columnDef.meta?.action?.(cell.row)}
    className="leading-4"
  >
    <Translate>Edit</Translate>
  </Button>
);

const TitleCell = ({ row, getValue }: CellContext<ClientSettingsLinkSchema, string>) => (
  <div className="flex items-center gap-2">
    <Translate
      context="Menu"
      className={row.getIsExpanded() ? 'text-indigo-900' : 'text-indigo-800'}
    >
      {getValue()}
    </Translate>
    {row.original.type === 'group' && (
      <EmbededButton
        icon={row.getIsExpanded() ? <ChevronUpIcon /> : <ChevronDownIcon />}
        onClick={() => row.toggleExpanded()}
        color="indigo"
        disabled={row.getCanExpand() === false}
      >
        <Translate>Group</Translate>
      </EmbededButton>
    )}
  </div>
);

const TitleHeader = () => <Translate>Label</Translate>;
const URLHeader = () => <Translate>URL</Translate>;
const ActionHeader = () => <Translate>Action</Translate>;

const columnHelper = createColumnHelper<any>();
const columns = (actions: { edit: Function }) => [
  columnHelper.accessor('title', {
    id: 'title',
    header: TitleHeader,
    cell: TitleCell,
    enableSorting: false,
    meta: { headerClassName: 'w-6/12' },
  }) as ColumnDef<ClientSettingsLinkSchema, 'title'>,
  columnHelper.accessor('url', {
    header: URLHeader,
    enableSorting: false,
    meta: { headerClassName: 'w-6/12' },
  }) as ColumnDef<ClientSettingsLinkSchema, 'default'>,
  columnHelper.accessor('key', {
    header: ActionHeader,
    cell: EditButton,
    enableSorting: false,
    meta: { action: actions.edit, headerClassName: 'sr-only invisible bg-gray-50' },
  }) as ColumnDef<ClientSettingsLinkSchema, 'key'>,
];
export { EditButton, TitleHeader, URLHeader, TitleCell, columns };
