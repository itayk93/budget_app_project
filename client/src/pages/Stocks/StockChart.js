
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

const StockChart = () => {
    const { symbol } = useParams();
    const [chartData, setChartData] = useState(null);
    const [currentPrice, setCurrentPrice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState('1y');

    const periods = [
        { value: '1w', label: '1 שבוע' },
        { value: '1m', label: '1 חודש' },
        { value: '3m', label: '3 חודשים' },
        { value: '6m', label: '6 חודשים' },
        { value: '1y', label: '1 שנה' },
        { value: '2y', label: '2 שנים' }
    ];

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                
                // Fetch chart data
                const chartResponse = await api.get(`/stocks/chart-data/${symbol}?period=${period}`);
                if (chartResponse.data.success) {
                    setChartData(chartResponse.data.data);
                } else {
                    throw new Error(chartResponse.data.error || 'No chart data available');
                }

                // Fetch current price
                try {
                    const priceResponse = await api.get(`/stocks/price/${symbol}`);
                    if (priceResponse.data.success) {
                        setCurrentPrice(priceResponse.data.data);
                    }
                } catch (priceErr) {
                    console.warn('Could not fetch current price:', priceErr);
                }

                setError(null);
            } catch (err) {
                console.error('Chart data error:', err);
                setError(err.response?.data?.error || err.message || 'שגיאה בטעינת נתוני הגרף');
            } finally {
                setLoading(false);
            }
        };

        if (symbol) {
            fetchData();
        }
    }, [symbol, period]);

    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(price || 0);
    };

    const formatTooltipLabel = (label) => {
        return new Date(label).toLocaleDateString('he-IL');
    };

    const formatTooltipValue = (value, name) => {
        return [formatPrice(value), name === 'close' ? 'מחיר סגירה' : name];
    };

    if (loading) {
        return (
            <div className="container-fluid">
                <div className="text-center mt-5">
                    <LoadingSpinner />
                    <p className="mt-3">טוען נתוני גרף עבור {symbol}...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="stock-chart-page">
            <div className="container-fluid">
                {/* Header */}
                <div className="chart-header">
                    <div className="header-content">
                        <div className="stock-info">
                            <h1>
                                <i className="fas fa-chart-line me-2"></i>
                                {symbol}
                            </h1>
                            {currentPrice && (
                                <div className="current-price-info">
                                    <div className="price">{formatPrice(currentPrice.price)}</div>
                                    {currentPrice.change && (
                                        <div className={`change ${currentPrice.change >= 0 ? 'positive' : 'negative'}`}>
                                            {currentPrice.change >= 0 ? '+' : ''}{formatPrice(currentPrice.change)}
                                            ({currentPrice.changePercent >= 0 ? '+' : ''}{currentPrice.changePercent?.toFixed(2)}%)
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="header-actions">
                            <Link to="/stocks" className="btn btn-outline-primary">
                                <i className="fas fa-arrow-right me-2"></i>
                                חזרה לדשבורד
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="container">
                    {error ? (
                        <div className="alert alert-danger">
                            <i className="fas fa-exclamation-circle me-2"></i>
                            {error}
                        </div>
                    ) : (
                        <>
                            {/* Period Selector */}
                            <div className="period-selector mb-4">
                                <div className="btn-group" role="group">
                                    {periods.map(p => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            className={`btn ${period === p.value ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setPeriod(p.value)}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="chart-container">
                                <div className="card">
                                    <div className="card-header">
                                        <h5 className="mb-0">
                                            גרף מחירים - {periods.find(p => p.value === period)?.label}
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        {chartData && chartData.data && chartData.data.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={500}>
                                                <LineChart data={chartData.data}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis 
                                                        dataKey="date" 
                                                        tickFormatter={formatTooltipLabel}
                                                    />
                                                    <YAxis 
                                                        tickFormatter={(value) => `$${value}`}
                                                        domain={['dataMin - 5', 'dataMax + 5']}
                                                    />
                                                    <Tooltip 
                                                        labelFormatter={formatTooltipLabel}
                                                        formatter={formatTooltipValue}
                                                        contentStyle={{
                                                            backgroundColor: '#fff',
                                                            border: '1px solid #ccc',
                                                            borderRadius: '4px'
                                                        }}
                                                    />
                                                    <Legend />
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey="close" 
                                                        stroke="#2563eb" 
                                                        strokeWidth={2}
                                                        dot={false}
                                                        activeDot={{ r: 4, fill: '#2563eb' }}
                                                        name="מחיר סגירה"
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="no-data text-center py-5">
                                                <i className="fas fa-chart-line-down empty-icon"></i>
                                                <h6>אין נתונים זמינים</h6>
                                                <p className="text-muted">
                                                    לא נמצאו נתוני מחירים עבור {symbol} בתקופה הנבחרת
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Additional Info */}
                            {chartData && chartData.metadata && (
                                <div className="chart-metadata mt-4">
                                    <div className="card">
                                        <div className="card-body">
                                            <h6>מידע נוסף</h6>
                                            <div className="row">
                                                <div className="col-md-4">
                                                    <small className="text-muted">נקודות מידע:</small>
                                                    <div>{chartData.metadata.dataPoints}</div>
                                                </div>
                                                <div className="col-md-4">
                                                    <small className="text-muted">תאריך התחלה:</small>
                                                    <div>{chartData.metadata.startDate ? new Date(chartData.metadata.startDate).toLocaleDateString('he-IL') : '-'}</div>
                                                </div>
                                                <div className="col-md-4">
                                                    <small className="text-muted">תאריך סיום:</small>
                                                    <div>{chartData.metadata.endDate ? new Date(chartData.metadata.endDate).toLocaleDateString('he-IL') : '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockChart;
