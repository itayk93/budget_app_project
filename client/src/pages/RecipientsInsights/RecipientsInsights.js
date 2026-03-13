import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { transactionsAPI } from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import './RecipientsInsights.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const presets = [
  { key: '30', label: '30 ימים', days: 30 },
  { key: '90', label: '90 ימים', days: 90 },
  { key: '180', label: 'חצי שנה', days: 180 },
  { key: '365', label: 'שנה', days: 365 },
  { key: 'all', label: 'הכל', days: null }
];

const formatAmount = (value) =>
  `${Math.abs(value || 0).toLocaleString('he-IL')} ₪`;

const getDateString = (date) => date.toISOString().slice(0, 10);

const buildDateRangeFromPreset = (presetKey) => {
  if (presetKey === 'all') return { start: null, end: null };
  const preset = presets.find((p) => p.key === presetKey);
  if (!preset || !preset.days) return { start: null, end: null };
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - preset.days);
  return { start: getDateString(start), end: getDateString(end) };
};

function RecipientsInsights() {
  const [rangePreset, setRangePreset] = useState('90');
  const [startDate, setStartDate] = useState(buildDateRangeFromPreset('90').start);
  const [endDate, setEndDate] = useState(buildDateRangeFromPreset('90').end);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        direction: 'outgoing',
        execution_methods: 'bit,paybox',
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 50
      };
      const result = await transactionsAPI.getRecipientsAnalytics(params);
      setAnalytics(result);
    } catch (err) {
      console.error('Failed to load recipients analytics', err);
      setError('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const timelineChart = useMemo(() => {
    if (!analytics?.timeline) return null;
    const labels = analytics.timeline.map((item) => item.period);
    const data = analytics.timeline.map((item) => Math.abs(item.total));
    return {
      labels,
      datasets: [
        {
          label: 'סה״כ העברות ביט/פייבוקס',
          data,
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  }, [analytics]);

  const handlePresetClick = (presetKey) => {
    setRangePreset(presetKey);
    const range = buildDateRangeFromPreset(presetKey);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const summary = useMemo(() => {
    if (!analytics) return null;
    const totalOut = analytics.recipients?.reduce((sum, r) => sum + Math.abs(r.total || 0), 0) || 0;
    const txCount = analytics.total_transactions || 0;
    const topRecipient = analytics.recipients?.[0]?.recipient_name || '—';
    return { totalOut, txCount, topRecipient };
  }, [analytics]);

  return (
    <div className="recipients-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">ניתוח העברות ביט/פייבוקס</div>
          <h1>למי הכסף יוצא?</h1>
          <p className="subtitle">
            Drill down לפי מקבל, קטגוריה והערות עם פילוח זמן.
          </p>
        </div>
        <div className="filters">
          <div className="preset-group">
            {presets.map((preset) => (
              <button
                key={preset.key}
                className={`preset-btn ${rangePreset === preset.key ? 'active' : ''}`}
                onClick={() => handlePresetClick(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="date-range">
            <div className="date-field">
              <label>מתאריך</label>
              <input
                type="date"
                value={startDate || ''}
                onChange={(e) => setStartDate(e.target.value || null)}
              />
            </div>
            <div className="date-field">
              <label>עד תאריך</label>
              <input
                type="date"
                value={endDate || ''}
                onChange={(e) => setEndDate(e.target.value || null)}
              />
            </div>
            <button className="refresh-btn" onClick={fetchData}>
              רענן
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <LoadingSpinner />
          <p>טוען נתונים...</p>
        </div>
      )}

      {error && <div className="error-state">{error}</div>}

      {!loading && analytics && (
        <>
          <div className="summary-cards">
            <div className="summary-card highlight">
              <div className="label">סה״כ העברות</div>
              <div className="value">{formatAmount(summary.totalOut)}</div>
              <div className="hint">בטווח הנבחר</div>
            </div>
            <div className="summary-card">
              <div className="label">מספר העברות</div>
              <div className="value">{summary.txCount.toLocaleString('he-IL')}</div>
            </div>
            <div className="summary-card">
              <div className="label">מקבל מוביל</div>
              <div className="value">{summary.topRecipient}</div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <h3>קצב העברות לאורך זמן</h3>
              <span className="chart-subtitle">סכומים מוחלטים (₪)</span>
            </div>
            {timelineChart ? (
              <Line
                data={timelineChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `${formatAmount(ctx.parsed.y)}`
                      }
                    }
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(0,0,0,0.08)' } }
                  }
                }}
              />
            ) : (
              <div className="empty-state">אין נתונים להצגה</div>
            )}
          </div>

          <div className="recipients-section">
            <div className="section-header">
              <h3>מקבלים מובילים</h3>
              <span className="chart-subtitle">כולל קטגוריות והערות לדילוג מהיר</span>
            </div>
            <div className="recipients-grid">
              {(analytics.recipients || []).map((rec) => (
                <div key={rec.recipient_name} className="recipient-card">
                  <div className="recipient-header">
                    <div>
                      <div className="recipient-name">{rec.recipient_name}</div>
                      <div className="recipient-amount">{formatAmount(rec.total)}</div>
                    </div>
                    <div className="badge">‏{rec.tx_count} העברות</div>
                  </div>

                  <div className="categories">
                    {rec.categories.slice(0, 4).map((cat) => (
                      <span key={cat.name} className="chip">
                        {cat.name} · {formatAmount(cat.total)}
                      </span>
                    ))}
                  </div>

                    {rec.sample_notes?.length > 0 && (
                      <div className="notes">
                        {rec.sample_notes.slice(0, 2).map((note, idx) => (
                          <div key={idx} className="note-line">
                            {note}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default RecipientsInsights;
