import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Transaction, Wallet, CurrencyType } from '../types';
import { formatCurrency, formatMonthYear } from '../utils/formatters';

interface StatementPdfData {
  monthKey: string; // "YYYY-MM" or "all"
  currency: CurrencyType;
  wallets: Wallet[];
  transactions: Transaction[];
  exchangeRate?: number;
}

/**
 * Generate and share a clean, formal monthly financial statement PDF.
 */
export async function generateAndShareStatementPdf(data: StatementPdfData): Promise<string> {
  const { monthKey, currency, wallets, transactions } = data;

  // Filter transactions for this month and currency
  const monthTxs = transactions.filter((t) => {
    if (monthKey !== 'all' && !t.timestamp.startsWith(monthKey)) return false;
    return t.currency === currency;
  });

  // Calculate totals
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals: Record<string, number> = {};

  for (const tx of monthTxs) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount;
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
    }
  }

  const netSavings = totalIncome - totalExpense;
  const periodLabel = monthKey === 'all' ? 'All Time' : formatMonthYear(monthKey);
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Sort categories by expenditure
  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Filter wallets with active currency
  const matchingWallets = wallets.filter((w) => w.currency === currency);
  const totalAccountBalance = matchingWallets.reduce((acc, w) => acc + w.balance, 0);

  // Generate HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>REKA Financial Statement - ${periodLabel}</title>
  <style>
    @page {
      margin: 20mm 15mm 20mm 15mm;
      size: A4 portrait;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #222222;
      padding-bottom: 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #111111;
    }
    .brand-sub {
      font-size: 10px;
      color: #666666;
      letter-spacing: 0.5px;
      margin-top: 2px;
      text-transform: uppercase;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #222222;
    }
    .doc-period {
      font-size: 11px;
      font-weight: 600;
      color: #555555;
      margin-top: 2px;
    }
    .doc-date {
      font-size: 9px;
      color: #888888;
      margin-top: 2px;
    }

    /* Summary Grid */
    .summary-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 22px;
    }
    .summary-card {
      flex: 1;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 10px 12px;
      background: #fafafa;
    }
    .summary-label {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      color: #777777;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .summary-value {
      font-size: 14px;
      font-weight: 700;
      color: #111111;
    }
    .summary-value.income {
      color: #1b873f;
    }
    .summary-value.expense {
      color: #c93434;
    }
    .summary-value.net {
      color: ${netSavings >= 0 ? '#1b873f' : '#c93434'};
    }

    /* Section titles */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #333333;
      margin-top: 18px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 4px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th {
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666666;
      border-bottom: 1px solid #cccccc;
      padding: 6px 8px;
      background: #f5f5f5;
    }
    th.text-right, td.text-right {
      text-align: right;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #eeeeee;
      font-size: 10px;
    }
    tr:nth-child(even) td {
      background: #fbfbfb;
    }
    .type-income {
      color: #1b873f;
      font-weight: 600;
    }
    .type-expense {
      color: #c93434;
      font-weight: 600;
    }
    .text-muted {
      color: #888888;
      font-size: 9px;
    }

    /* Footer */
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e0e0e0;
      padding-top: 10px;
      text-align: center;
      font-size: 9px;
      color: #999999;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">REKA</div>
      <div class="brand-sub">Personal Financial Ledger</div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">Financial Statement</div>
      <div class="doc-period">${periodLabel} (${currency})</div>
      <div class="doc-date">Generated on ${generatedDate}</div>
    </div>
  </div>

  <!-- Key Figures -->
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Inflow</div>
      <div class="summary-value income">+${formatCurrency(totalIncome, currency)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Outflow</div>
      <div class="summary-value expense">-${formatCurrency(totalExpense, currency)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Net Cash Flow</div>
      <div class="summary-value net">${netSavings >= 0 ? '+' : ''}${formatCurrency(netSavings, currency)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Ending Balance</div>
      <div class="summary-value">${formatCurrency(totalAccountBalance, currency)}</div>
    </div>
  </div>

  <!-- Accounts Summary -->
  <div class="section-title">Accounts Overview</div>
  <table>
    <thead>
      <tr>
        <th>Account Name</th>
        <th>Type</th>
        <th>Account Number</th>
        <th class="text-right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${matchingWallets
        .map(
          (w) => `
        <tr>
          <td><strong>${w.name}</strong></td>
          <td>${w.type.toUpperCase()}</td>
          <td>${w.accountNumber || '-'}</td>
          <td class="text-right"><strong>${formatCurrency(w.balance, w.currency)}</strong></td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <!-- Top Categories -->
  ${
    sortedCategories.length > 0
      ? `
    <div class="section-title">Top Expense Categories</div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th class="text-right">Total Spent</th>
          <th class="text-right">Share of Outflow</th>
        </tr>
      </thead>
      <tbody>
        ${sortedCategories
          .map(([cat, amount]) => {
            const share = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
            return `
            <tr>
              <td><strong>${cat}</strong></td>
              <td class="text-right">${formatCurrency(amount, currency)}</td>
              <td class="text-right">${share}%</td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>
  `
      : ''
  }

  <!-- Transaction Records -->
  <div class="section-title">Transaction Records (${monthTxs.length})</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Description / Merchant</th>
        <th>Category</th>
        <th>Method</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${
        monthTxs.length === 0
          ? `<tr><td colspan="5" style="text-align: center; padding: 16px; color: #888888;">No transactions recorded for this period.</td></tr>`
          : monthTxs
              .map((tx) => {
                const datePart = tx.timestamp.split('T')[0] || tx.timestamp;
                const isIncome = tx.type === 'income';
                return `
            <tr>
              <td>${datePart}</td>
              <td><strong>${tx.merchantName || tx.notes || 'Transaction'}</strong></td>
              <td>${tx.category}</td>
              <td class="text-muted">${tx.paymentMethod || 'Other'}</td>
              <td class="text-right ${isIncome ? 'type-income' : 'type-expense'}">
                ${isIncome ? '+' : '-'}${formatCurrency(tx.amount, tx.currency)}
              </td>
            </tr>
          `;
              })
              .join('')
      }
    </tbody>
  </table>

  <div class="footer">
    This financial statement was generated on-device with REKA. All financial records remain stored locally on your device.
  </div>
</body>
</html>
  `;

  // Render HTML to PDF file
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // Share or save via OS dialog
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `REKA Statement - ${periodLabel}`,
    });
  }

  return uri;
}
