
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

const Alerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                setLoading(true);
                const { data } = await api.get('/alerts');
                setAlerts(data);
                setError(null);
            } catch (err) {
                setError('Failed to fetch alerts.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAlerts();
    }, []);

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <div className="alert alert-danger">{error}</div>;
    }

    return (
        <div className="container mt-4">
            <h2>ניהול התראות</h2>
            {/* Add alert creation form here */}
            <table className="table table-striped">
                <thead>
                    <tr>
                        <th>מניה</th>
                        <th>סוג התראה</th>
                        <th>ערך מטרה</th>
                        <th>פעיל</th>
                        <th>פעולות</th>
                    </tr>
                </thead>
                <tbody>
                    {alerts.map(alert => (
                        <tr key={alert.id}>
                            <td>{alert.stock_symbol}</td>
                            <td>{alert.alert_type}</td>
                            <td>{alert.target_value}</td>
                            <td>{alert.is_active ? 'כן' : 'לא'}</td>
                            <td>
                                {/* Add edit/delete buttons here */}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Alerts;
