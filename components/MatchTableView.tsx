import { MatchTable } from '@/lib/apiFootball';

export default function MatchTableView({ table }: { table: MatchTable }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline">
      <table className="w-full text-left text-xs">
        <thead className="bg-elevated text-inksecondary">
          <tr>
            {table.headers.map((cell, i) => (
              <th key={i} className="px-3 py-2 font-medium whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {table.rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-2 text-ink whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
