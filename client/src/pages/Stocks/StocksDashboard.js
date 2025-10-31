import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';

import api from '../../services/api';
import BlinkScreenshotUpload from '../../components/Stocks/BlinkScreenshotUpload';
import PortfolioSummary from '../../components/Stocks/PortfolioSummary';
import MonthlyPerformance from '../../components/Stocks/MonthlyPerformance';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- Helper Functions ---
const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return '-';
    
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    
    // הוספת מינוס בצד שמאל
    return value < 0 ? `-${formatted}` : formatted;
};

const formatPercentage = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00%';
    return `${(value * 100).toFixed(2)}%`;
};

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const parsePriceFromNotes = (notes) => {
    if (!notes) return null;
    const match = notes.match(/Price: \$([\d,]+\.\d+)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : null;
};

const calculateMonthlyPerformance = (transactions) => {
    if (!transactions || transactions.length === 0) return [];
    
    const monthlyData = {};
    
    transactions.forEach(tx => {
        const date = new Date(tx.payment_date || tx.transaction_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                month: monthKey,
                deposits: 0,
                invested: 0,
                returns: 0,
                dividends: 0,
                fees: 0
            };
        }
        
        const amount = Math.abs(parseFloat(tx.amount || tx.total_amount || 0));
        const businessName = tx.business_name || tx.stock_symbol || '';
        
        // סיווג לפי סוג העסקה
        if (businessName.includes('הפקדה')) {
            monthlyData[monthKey].deposits += amount;
        } else if (businessName.includes('עמלת')) {
            monthlyData[monthKey].fees += amount;
        } else if (businessName.includes('דיבידנד')) {
            monthlyData[monthKey].dividends += amount;
        } else if (tx.transaction_type === 'Buy' || tx.transaction_type === 'buy') {
            monthlyData[monthKey].invested += amount;
        } else if (tx.transaction_type === 'Sell' || tx.transaction_type === 'sell') {
            monthlyData[monthKey].returns += amount;
        }
    });
    
    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
};


// --- Data Processing Hook ---
const usePortfolioData = (transactions, currentPrices = {}) => {
    return useMemo(() => {
        console.log('🔄 Processing transactions:', transactions.length);
        
        const holdings = {};
        const realizedGains = [];
        const summary = {
            deposits: 0,
            withdrawals: 0,
            fees: 0,
            taxes: 0,
            dividends: 0,
            cash: 0,
            totalInvested: 0,
        };
        const lastPrices = {};

        if (transactions.length === 0) {
            console.log('⚠️ No transactions to process');
            return {
                summary,
                currentHoldings: [],
                realizedGains: [],
                allTransactions: [],
                lastPrices: {},
            };
        }

        const sortedTransactions = [...transactions]
            .map(tx => ({
                ...tx,
                // Map API fields to expected fields
                business_name: tx.stock_symbol || tx.business_name,
                amount: parseFloat(tx.total_amount || tx.amount),
                quantity: parseFloat(tx.quantity) || 0,
                payment_date: new Date(tx.transaction_date || tx.payment_date),
                transaction_type: tx.transaction_type,
                notes: tx.notes
            }))
            .sort((a, b) => {
                // First sort by date
                const dateCompare = a.payment_date - b.payment_date;
                if (dateCompare !== 0) return dateCompare;
                
                // If same date, always use created_at timestamp for chronological order
                const aCreated = new Date(a.created_at);
                const bCreated = new Date(b.created_at);
                return aCreated - bCreated;
            });

        console.log('📈 Sample processed transaction:', sortedTransactions[0]);
        console.log('📊 All unique transaction types:', [...new Set(sortedTransactions.map(tx => tx.transaction_type))]);
        
        // Debug CRCL transactions specifically  
        const crclTransactions = sortedTransactions.filter(tx => tx.business_name === 'CRCL');
        if (crclTransactions.length > 0) {
            console.log('🎯 ALL CRCL transactions in order:', crclTransactions.map(tx => ({
                type: tx.transaction_type,
                quantity: tx.quantity,
                amount: tx.amount,
                date: tx.payment_date,
                created: tx.created_at
            })));
            window.crclTransactions = crclTransactions;
        }
        
        // Debug quantity parsing
        const sampleTx = sortedTransactions[0];
        if (sampleTx) {
            console.log('🔍 Sample transaction details:');
            console.log('  - business_name:', sampleTx.business_name);
            console.log('  - quantity (parsed):', sampleTx.quantity, typeof sampleTx.quantity);
            console.log('  - notes:', sampleTx.notes);
            console.log('  - parsed price:', parsePriceFromNotes(sampleTx.notes));
        }

        sortedTransactions.forEach((tx, index) => {
            const { business_name, transaction_type, amount, quantity, notes, payment_date } = tx;
            const price = parsePriceFromNotes(notes);
            
            // Debug CRCL transactions specifically
            if (business_name === 'CRCL') {
                console.log(`🎯 CRCL Transaction ${index + 1}:`, {
                    business_name,
                    transaction_type,
                    quantity: quantity,
                    amount,
                    payment_date,
                    created_at: tx.created_at,
                    notes,
                    willBeProcessed: business_name && 
                                   business_name !== 'הפקדה' && 
                                   !business_name.includes('חיוב מס') && 
                                   parseFloat(quantity || 0) > 0 && 
                                   !business_name.includes('הפקדה לחשבון השקעות')
                });
            }
            
            // Debug first few transactions
            if (index < 3) {
                console.log(`🔍 Processing transaction ${index + 1}:`, {
                    business_name,
                    quantity,
                    amount,
                    transaction_type,
                    notes
                });
            }
            
            // Normalize transaction type to match our logic
            const normalizedType = transaction_type ? transaction_type.charAt(0).toUpperCase() + transaction_type.slice(1).toLowerCase() : '';
            
            if (price && (normalizedType === 'Buy' || normalizedType === 'Sell')) {
                lastPrices[business_name] = price;
            }

            // Handle deposits, fees, taxes separately by name patterns
            if (business_name.includes('הפקדה')) {
                summary.deposits += Math.abs(amount);
                summary.cash += Math.abs(amount);
            } else if (business_name.includes('עמלת')) {
                summary.fees += Math.abs(amount);
                summary.cash -= Math.abs(amount);
            } else if (business_name.includes('חיוב מס') || business_name.includes('מס')) {
                summary.taxes += Math.abs(amount);
                summary.cash -= Math.abs(amount);
            } else if (business_name.includes('זיכוי מס')) {
                summary.taxes -= Math.abs(amount);
                summary.cash += Math.abs(amount);
            } else if (quantity > 0 && !business_name.includes('הפקדה לחשבון השקעות') && business_name !== 'הפקדה') {
                // Debug stock transaction condition
                if (index < 3) {
                    console.log(`✅ Found stock transaction: ${business_name}, qty: ${quantity}`);
                }
                // This is a stock transaction - determine buy/sell by transaction_type field
                const isBuy = normalizedType === 'Buy';
                const isSell = normalizedType === 'Sell';
                
                if (isBuy) {
                    // Buy transaction
                    if (!holdings[business_name]) {
                        holdings[business_name] = {
                            ticker: business_name,
                            quantity: 0,
                            totalCost: 0,
                            buyTrades: [],
                        };
                    }
                    const cost = Math.abs(amount);
                    holdings[business_name].quantity += quantity;
                    holdings[business_name].totalCost += cost;
                    holdings[business_name].buyTrades.push({ quantity, price: cost / quantity, date: payment_date });
                    summary.cash -= cost;
                    summary.totalInvested += cost;
                    
                    // Round quantity to avoid floating point precision issues
                    holdings[business_name].quantity = Math.round(holdings[business_name].quantity * 10000) / 10000;
                } else if (isSell) {
                    // Sell transaction
                    if (!holdings[business_name]) {
                        console.warn(`⚠️ Attempting to sell ${business_name} but no holdings exist. Creating negative position.`);
                        holdings[business_name] = {
                            ticker: business_name,
                            quantity: 0,
                            totalCost: 0,
                            buyTrades: [],
                        };
                    }
                    const proceeds = Math.abs(amount);
                    let quantityToSell = quantity;
                    let costOfGoodsSold = 0;

                    // FIFO logic
                    const remainingTrades = [];
                    for (const buyTrade of holdings[business_name].buyTrades) {
                        if (quantityToSell > 0) {
                            const sellableQuantity = Math.min(quantityToSell, buyTrade.quantity);
                            costOfGoodsSold += sellableQuantity * buyTrade.price;
                            quantityToSell -= sellableQuantity;

                            if (buyTrade.quantity > sellableQuantity) {
                                remainingTrades.push({ ...buyTrade, quantity: buyTrade.quantity - sellableQuantity });
                            }
                        } else {
                            remainingTrades.push(buyTrade);
                        }
                    }
                    
                    const profit = proceeds - costOfGoodsSold;
                    realizedGains.push({
                        ticker: business_name,
                        sellDate: payment_date,
                        quantity,
                        sellPrice: price,
                        cost: costOfGoodsSold,
                        profit,
                    });

                    holdings[business_name].quantity -= quantity;
                    holdings[business_name].totalCost -= costOfGoodsSold;
                    holdings[business_name].buyTrades = remainingTrades;

                    summary.cash += proceeds;
                    summary.totalInvested -= costOfGoodsSold;

                    console.log(`📊 After sell transaction for ${business_name}:`, {
                        remainingQuantity: holdings[business_name].quantity,
                        soldQuantity: quantity,
                        shouldDelete: holdings[business_name].quantity < 0.00001
                    });

                    // Round quantity to avoid floating point precision issues
                    holdings[business_name].quantity = Math.round(holdings[business_name].quantity * 10000) / 10000;
                    
                    if (Math.abs(holdings[business_name].quantity) < 0.00001) {
                        console.log(`🗑️ Deleting ${business_name} - quantity too small: ${holdings[business_name].quantity}`);
                        delete holdings[business_name];
                    }
                    
                    // Special debug for CRCL
                    if (business_name === 'CRCL') {
                        console.log(`🎯 CRCL after sell processing:`, {
                            quantity: holdings[business_name]?.quantity,
                            wasDeleted: !holdings[business_name],
                            shouldDelete: Math.abs(holdings[business_name]?.quantity || 0) < 0.00001
                        });
                    }
                }
            } else {
                // Debug why transaction was skipped
                if (index < 5) {
                    console.log(`❌ Skipped transaction ${index + 1}:`, {
                        business_name,
                        quantity,
                        'quantity > 0': quantity > 0,
                        'not deposit account': !business_name.includes('הפקדה לחשבון השקעות'),
                        'not deposit': business_name !== 'הפקדה'
                    });
                }
            }
        });

        const currentHoldings = Object.values(holdings).map(h => {
            const avgCost = h.quantity > 0 ? h.totalCost / h.quantity : 0;
            // Prefer current prices from API over last transaction prices
            const currentPrice = currentPrices[h.ticker] || lastPrices[h.ticker] || avgCost;
            const marketValue = h.quantity * currentPrice;
            const unrealizedPL = marketValue - h.totalCost;
            const unrealizedPLPercent = h.totalCost > 0 ? unrealizedPL / h.totalCost : 0;
            return {
                ...h,
                avgCost: isNaN(avgCost) || !isFinite(avgCost) ? 0 : avgCost,
                currentPrice: isNaN(currentPrice) || !isFinite(currentPrice) ? 0 : currentPrice,
                marketValue: isNaN(marketValue) || !isFinite(marketValue) ? 0 : marketValue,
                unrealizedPL: isNaN(unrealizedPL) || !isFinite(unrealizedPL) ? 0 : unrealizedPL,
                unrealizedPLPercent: isNaN(unrealizedPLPercent) || !isFinite(unrealizedPLPercent) ? 0 : unrealizedPLPercent,
            };
        });

        const totalMarketValue = currentHoldings.reduce((sum, h) => sum + h.marketValue, 0);
        const totalUnrealizedPL = currentHoldings.reduce((sum, h) => sum + h.unrealizedPL, 0);
        const totalRealizedPL = realizedGains.reduce((sum, g) => sum + g.profit, 0);
        const totalPL = totalUnrealizedPL + totalRealizedPL;
        const portfolioValue = totalMarketValue + summary.cash;

        console.log('💰 Final summary:', {
            holdings: currentHoldings.length,
            portfolioValue,
            totalPL,
            cash: summary.cash,
            deposits: summary.deposits,
            fees: summary.fees,
            taxes: summary.taxes,
            totalInvested: summary.totalInvested
        });
        
        console.log('💰 Cash calculation breakdown:', {
            startingCash: 0,
            deposits: `+${summary.deposits}`,
            stockPurchases: `-${summary.totalInvested}`,
            stockSales: `+${realizedGains.reduce((sum, g) => sum + g.quantity * g.sellPrice, 0)}`,
            fees: `-${summary.fees}`,
            taxes: `net: ${summary.taxes > 0 ? '-' : '+'}${Math.abs(summary.taxes)}`,
            finalCash: summary.cash
        });
        
        // Debug current holdings
        console.log('🔍 Current holdings details:', currentHoldings);
        
        // Special debug for CRCL
        const crclHolding = currentHoldings.find(h => h.ticker === 'CRCL');
        console.log('🎯 CRCL final status:', {
            exists: !!crclHolding,
            quantity: crclHolding?.quantity || 'N/A',
            marketValue: crclHolding?.marketValue || 'N/A'
        });
        
        if (currentHoldings.length > 0) {
            console.log('📊 Sample holding:', currentHoldings[0]);
        } else {
            console.log('⚠️ No current holdings found - investigating why...');
            console.log('📋 Holdings object keys:', Object.keys(holdings));
            console.log('📋 Holdings object:', holdings);
        }

        return {
            summary: { ...summary, totalPL, totalRealizedPL, totalUnrealizedPL, portfolioValue, totalMarketValue },
            currentHoldings,
            realizedGains,
            allTransactions: sortedTransactions,
            lastPrices,
        };
    }, [transactions, currentPrices]);
};

// --- UI Components ---

// Removed unused Card component



const HoldingsTable = ({ holdings }) => (
    <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflowX: 'auto'
    }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem' }}>החזקות נוכחיות</h3>
        <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
            <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'right' }}>נייר ערך</th>
                    <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'center' }}>כמות</th>
                    <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'center' }}>עלות ממוצעת</th>
                    <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'center' }}>שווי שוק</th>
                    <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'center' }}>רווח/הפסד לא ממומש</th>
                </tr>
            </thead>
            <tbody>
                {[...holdings].sort((a, b) => b.unrealizedPLPercent - a.unrealizedPLPercent).map(h => {
                    const plColor = h.unrealizedPL >= 0 ? '#10b981' : '#ef4444';
                    return (
                        <tr key={h.ticker} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem', fontWeight: '700' }}>{h.ticker}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{h.quantity.toFixed(4)}</td>
                            <td className="currency-value" style={{ padding: '0.75rem', textAlign: 'center' }}>{formatCurrency(h.avgCost)}</td>
                            <td className="currency-value" style={{ padding: '0.75rem', textAlign: 'center' }}>{formatCurrency(h.marketValue)}</td>
                            <td className="currency-value" style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: plColor }}>
                                {formatCurrency(h.unrealizedPL)}
                                <div style={{ fontSize: '0.75rem', fontWeight: '400' }}>({formatPercentage(h.unrealizedPLPercent)})</div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

const RealizedGainsTable = ({ gains }) => (
    <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        marginTop: '1.5rem'
    }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem' }}>עסקאות שהושלמו (רווח ממומש)</h3>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                        <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'right' }}>נייר ערך</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'center' }}>תאריך מכירה</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'center' }}>כמות</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'center' }}>רווח/הפסד</th>
                    </tr>
                </thead>
                <tbody>
                    {[...gains].reverse().map((g, index) => {
                        const profitColor = g.profit >= 0 ? '#10b981' : '#ef4444';
                        return (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.75rem', fontWeight: '700' }}>{g.ticker}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{formatDate(g.sellDate)}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{g.quantity.toFixed(4)}</td>
                                <td className="currency-value" style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: profitColor }}>{formatCurrency(g.profit)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

const AllTransactionsTable = ({ transactions }) => (
    <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        marginTop: '1.5rem'
    }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem' }}>היסטוריית עסקאות</h3>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                        <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'right' }}>תאריך</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'right' }}>תיאור</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'right' }}>סוג</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', textAlign: 'center' }}>סכום</th>
                    </tr>
                </thead>
                <tbody>
                    {[...transactions].reverse().map(tx => {
                        const amountColor = tx.amount > 0 ? '#10b981' : '#ef4444';
                        return (
                            <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.75rem', color: '#64748b' }}>{formatDate(tx.payment_date)}</td>
                                <td style={{ padding: '0.75rem', fontWeight: '600' }}>{tx.business_name}</td>
                                <td style={{ padding: '0.75rem', color: '#374151' }}>{tx.transaction_type}</td>
                                <td className="currency-value" style={{ padding: '0.75rem', textAlign: 'center', fontFamily: 'monospace', color: amountColor }}>{formatCurrency(tx.amount)}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

const PortfolioAllocation = ({ holdings }) => {
    const data = holdings
        .filter(h => h.marketValue > 0)
        .map(h => ({ name: h.ticker, value: h.marketValue }))
        .sort((a, b) => b.value - a.value);

    // Prepare data for pie chart
    const colors = ['#ef4444', '#f97316', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    
    const chartData = {
        labels: data.map(entry => entry.name),
        datasets: [
            {
                data: data.map(entry => entry.value),
                backgroundColor: colors.slice(0, data.length),
                borderColor: colors.slice(0, data.length).map(color => color),
                borderWidth: 2,
                hoverOffset: 4
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                rtl: true,
                labels: {
                    padding: 20,
                    font: {
                        size: 12,
                        family: 'system-ui'
                    },
                    generateLabels: function(chart) {
                        const dataset = chart.data.datasets[0];
                        const total = data.reduce((sum, item) => sum + item.value, 0);
                        return chart.data.labels.map((label, index) => {
                            const value = dataset.data[index];
                            const percentage = ((value / total) * 100).toFixed(1);
                            return {
                                text: `${label} (${percentage}%)`,
                                fillStyle: dataset.backgroundColor[index],
                                strokeStyle: dataset.borderColor[index],
                                lineWidth: dataset.borderWidth,
                                index: index
                            };
                        });
                    }
                }
            },
            tooltip: {
                rtl: true,
                callbacks: {
                    label: function(context) {
                        const total = data.reduce((sum, item) => sum + item.value, 0);
                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                        return `${context.label}: ${formatCurrency(context.parsed)} (${percentage}%)`;
                    }
                }
            }
        }
    };

    return (
        <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', marginBottom: '1rem' }}>פיזור התיק</h3>
            
            {data.length > 0 ? (
                <div className="portfolio-allocation-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '2rem', 
                    alignItems: 'center' 
                }}>
                    {/* Pie Chart */}
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Pie data={chartData} options={chartOptions} />
                    </div>
                    
                    {/* Legend with values */}
                    <div>
                        {data.map((entry, index) => {
                            const totalValue = data.reduce((sum, item) => sum + item.value, 0);
                            const percentage = (entry.value / totalValue) * 100;
                            const color = colors[index % colors.length];
                            return (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                                    <div style={{ 
                                        backgroundColor: color, 
                                        width: '1rem', 
                                        height: '1rem', 
                                        borderRadius: '50%',
                                        marginLeft: '0.75rem',
                                        marginRight: '0.5rem'
                                    }}></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <span style={{ fontWeight: '600', color: '#374151' }}>{entry.name}</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                                                {percentage.toFixed(1)}%
                                            </div>
                                            <div className="currency-value" style={{ fontFamily: 'monospace', color: '#374151', fontWeight: '600' }}>
                                                {formatCurrency(entry.value)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: '#64748b', textAlign: 'center' }}>אין החזקות להצגה</p>
                </div>
            )}
        </div>
    );
};

// --- Main App Component ---
export default function StocksDashboard() {
    const { onAction } = useOutletContext();
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [, setIsUpdating] = useState(false);
    const [error, setError] = useState(null);
    const [, setCashFlows] = useState([]);
    const [selectedCashFlowId, setSelectedCashFlowId] = useState('');
    const [currentPrices, setCurrentPrices] = useState({});
    const portfolioData = usePortfolioData(transactions, currentPrices);
    const [activeTab, setActiveTab] = useState('portfolio');
    const [showMonthlyChart, setShowMonthlyChart] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showManualEntryModal, setShowManualEntryModal] = useState(false);

    const fetchCashFlows = async () => {
        try {
            const response = await api.get('/stocks/investment-cash-flows');
            setCashFlows(response.cash_flows || []);
            if (response.cash_flows && response.cash_flows.length > 0) {
                setSelectedCashFlowId(response.cash_flows[0].id);
            } else {
                setError('לא נמצאו חשבונות השקעה. אנא יצור חשבון השקעה חדש.');
                setIsLoading(false);
            }
        } catch (err) {
            console.error('Error fetching cash flows:', err);
            setError('שגיאה בטעינת חשבונות השקעה: ' + (err.response?.data?.error || err.message));
            setIsLoading(false);
        }
    };

    const fetchTransactions = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();
            if (selectedCashFlowId) params.append('cash_flow_id', selectedCashFlowId);
            
            console.log('🔍 Fetching transactions with cash_flow_id:', selectedCashFlowId);
            const response = await api.get(`/stocks/transactions?${params.toString()}`);
            console.log('📊 Raw API response:', response);
            
            if (response.success) {
                console.log('✅ Transactions loaded:', response.transactions.length);
                console.log('📋 First 3 transactions:', response.transactions.slice(0, 3));
        // Let's see what stock symbols we have
        const stockSymbols = [...new Set(response.transactions.map(tx => tx.stock_symbol))];
        console.log('🏷️ All stock symbols:', stockSymbols);
                setTransactions(response.transactions);
            } else {
                console.error('❌ API returned success=false:', response);
                setError('Failed to fetch transactions');
            }
        } catch (err) {
            console.error('💥 API Error:', err);
            setError(err.message || 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [selectedCashFlowId]);

    const fetchCurrentPrices = useCallback(async () => {
        try {
            console.log('🔍 Fetching current prices...');
            const response = await api.get('/stocks/current-prices');
            if (response.success && response.prices) {
                console.log('📊 Current prices loaded:', response.prices);
                setCurrentPrices(response.prices);
            }
        } catch (err) {
            console.error('Error fetching current prices:', err);
        }
    }, []);

    const handleUpdatePrices = useCallback(async () => {
        setIsUpdating(true);
        setError(null);
        try {
            console.log('🔄 Starting price update...');
            const response = await api.post('/stocks/update-all-prices');
            console.log('📊 Price update response:', response);
            console.log('📋 Response data:', response);
            console.log('📋 Response type:', typeof response);
            
            // Handle the case where api interceptor already extracted .data
            const data = response.data || response;
            console.log('📋 Final data:', data);
            
            if (data && data.success) {
                console.log('✅ Prices updated successfully');
                // Refresh current prices after update
                await fetchCurrentPrices();
            } else {
                console.error('❌ Update failed:', data);
                setError(data?.message || 'Failed to update prices');
            }
        } catch (err) {
            console.error('💥 Error updating prices:', err);
            setError(err.message || 'Failed to update prices');
        } finally {
            setIsUpdating(false);
        }
    }, [fetchCurrentPrices]);

    useEffect(() => {
        fetchCashFlows();
    }, []);

    useEffect(() => {
        if (selectedCashFlowId) {
            fetchTransactions();
            fetchCurrentPrices();
        }
    }, [selectedCashFlowId, fetchTransactions, fetchCurrentPrices]);

    // Handle actions from sidebar
    useEffect(() => {
        if (onAction) {
            onAction({
                'update-prices': handleUpdatePrices,
                'monthly-chart': () => setShowMonthlyChart(true),
                'upload-screenshot': () => setShowUploadModal(true),
                'manual-entry': () => setShowManualEntryModal(true)
            });
        }
    }, [onAction, handleUpdatePrices]);

    const handleTransactionsImported = async (data) => {
        console.log('📸 Blink screenshot transactions imported:', data);
        // Refresh transactions and prices after successful import
        await fetchTransactions();
        await fetchCurrentPrices();
    };

    if (isLoading) {
        return <div style={{ textAlign: 'center', padding: '2rem' }}>טוען נתונים...</div>;
    }

    if (error) {
        return <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>שגיאה: {error}</div>;
    }

    const { summary, currentHoldings, realizedGains, allTransactions } = portfolioData;

    const renderContent = () => {
        switch (activeTab) {
            case 'portfolio':
                return (
                    <div style={{ marginTop: '1.5rem' }}>
                        <HoldingsTable holdings={currentHoldings} />
                        <div style={{ marginTop: '1.5rem' }}>
                            <PortfolioAllocation holdings={currentHoldings} />
                        </div>
                    </div>
                );
            case 'realized':
                return <RealizedGainsTable gains={realizedGains} />;
            case 'history':
                return <AllTransactionsTable transactions={allTransactions} />;
            default:
                return null;
        }
    };

    return (
        <>
            <div style={{ 
                direction: 'rtl', 
                backgroundColor: '#f9fafb', 
                minHeight: '100vh', 
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: '#111827'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 1.5rem 2rem' }}>
                    <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#1f2937', margin: 0 }}>דשבורד תיק השקעות</h1>
                        <p style={{ fontSize: '1.125rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>ניתוח ביצועים מבוסס עסקאות</p>
                    </header>

                    <PortfolioSummary summary={summary} />

                    <div style={{ marginTop: '2rem' }}>
                        <div style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <nav style={{ display: 'flex', gap: '1.5rem', marginBottom: '-1px' }} role="tablist">
                                <button
                                    onClick={() => setActiveTab('portfolio')}
                                    style={{
                                        whiteSpace: 'nowrap',
                                        padding: '1rem 0.25rem',
                                        borderTop: 'none',
                                        borderLeft: 'none',
                                        borderRight: 'none',
                                        borderBottom: `2px solid ${activeTab === 'portfolio' ? '#3b82f6' : 'transparent'}`,
                                        fontWeight: '500',
                                        fontSize: '1.125rem',
                                        color: activeTab === 'portfolio' ? '#2563eb' : '#64748b',
                                        background: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    תיק נוכחי
                                </button>
                                <button
                                    onClick={() => setActiveTab('realized')}
                                    style={{
                                        whiteSpace: 'nowrap',
                                        padding: '1rem 0.25rem',
                                        borderTop: 'none',
                                        borderLeft: 'none',
                                        borderRight: 'none',
                                        borderBottom: `2px solid ${activeTab === 'realized' ? '#3b82f6' : 'transparent'}`,
                                        fontWeight: '500',
                                        fontSize: '1.125rem',
                                        color: activeTab === 'realized' ? '#2563eb' : '#64748b',
                                        background: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    רווחים ממומשים
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    style={{
                                        whiteSpace: 'nowrap',
                                        padding: '1rem 0.25rem',
                                        borderTop: 'none',
                                        borderLeft: 'none',
                                        borderRight: 'none',
                                        borderBottom: `2px solid ${activeTab === 'history' ? '#3b82f6' : 'transparent'}`,
                                        fontWeight: '500',
                                        fontSize: '1.125rem',
                                        color: activeTab === 'history' ? '#2563eb' : '#64748b',
                                        background: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    היסטוריית עסקאות
                                </button>
                            </nav>
                        </div>
                        <div style={{ marginTop: '1.5rem' }}>{renderContent()}</div>
                    </div>

                    {/* Spacer before upload section */}
                    <div style={{ height: '3rem' }}></div>

                    {/* Blink Screenshot Upload - moved to bottom with more spacing */}
                    <BlinkScreenshotUpload 
                        cashFlowId={selectedCashFlowId} 
                        onTransactionsImported={handleTransactionsImported}
                    />
                </div>
            </div>

            {showMonthlyChart && (
                <div 
                    className="modal-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowMonthlyChart(false)}
                >
                    <div 
                        className="modal"
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '2rem',
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        }}
                        dir="rtl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexDirection: 'row-reverse' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                                גרף ביצועים חודשי
                            </h2>
                            <button
                                onClick={() => setShowMonthlyChart(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '0.5rem',
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <MonthlyPerformance monthlyPerformance={calculateMonthlyPerformance(transactions)} />
                    </div>
                </div>
            )}

            {showUploadModal && (
                <div 
                    className="modal-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowUploadModal(false)}
                >
                    <div 
                        className="modal"
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '2rem',
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        }}
                        dir="rtl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexDirection: 'row-reverse' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                                העלאת צילום מסך Blink
                            </h2>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '0.5rem',
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <BlinkScreenshotUpload 
                            cashFlowId={selectedCashFlowId}
                            onTransactionsImported={handleTransactionsImported}
                        />
                    </div>
                </div>
            )}

            {showManualEntryModal && (
                <div 
                    className="modal-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowManualEntryModal(false)}
                >
                    <div 
                        className="modal"
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '2rem',
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        }}
                        dir="rtl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexDirection: 'row-reverse' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                                רשומה ידנית
                            </h2>
                            <button
                                onClick={() => setShowManualEntryModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    padding: '0.5rem',
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✏️</div>
                            <h3>רשומה ידנית</h3>
                            <p>הפיצ'ר בפיתוח - בקרוב יתאפשר להוסיף עסקאות באופן ידני</p>
                        </div>
                    </div>
                </div>
            )}
            
            <style>
                {`
                    @media (max-width: 768px) {
                        .portfolio-allocation-grid {
                            grid-template-columns: 1fr !important;
                        }
                    }
                    
                    /* Force LTR direction for currency values to ensure minus sign is on the left */
                    .currency-value {
                        direction: ltr !important;
                        text-align: center !important;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                    }
                `}
            </style>
        </>
    );
}
