import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import api from '../../services/api';
import './Subscriptions.css';

const Subscriptions = () => {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const queryClient = useQueryClient();

  // Fetch subscriptions data
  const { data: subscriptions, isLoading, error } = useQuery(
    ['subscriptions', selectedStatus],
    async () => {
      const response = await api.get('/subscriptions', {
        params: selectedStatus !== 'all' ? { status: selectedStatus } : {}
      });
      return response.data;
    }
  );

  // Mutation for confirming subscription
  const confirmMutation = useMutation(
    (subscriptionId) => api.post(`/subscriptions/${subscriptionId}/confirm`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['subscriptions']);
      }
    }
  );

  // Mutation for rejecting subscription
  const rejectMutation = useMutation(
    (subscriptionId) => api.post(`/subscriptions/${subscriptionId}/reject`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['subscriptions']);
      }
    }
  );

  // Mutation for canceling subscription
  const cancelMutation = useMutation(
    (subscriptionId) => api.delete(`/subscriptions/${subscriptionId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['subscriptions']);
      }
    }
  );

  const handleConfirm = (subscriptionId) => {
    confirmMutation.mutate(subscriptionId);
  };

  const handleReject = (subscriptionId) => {
    rejectMutation.mutate(subscriptionId);
  };

  const handleCancel = (subscriptionId) => {
    if (window.confirm('האם אתה בטוח שברצונך לבטל מנוי זה?')) {
      cancelMutation.mutate(subscriptionId);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'פעיל';
      case 'pending_approval':
        return 'ממתין לאישור';
      case 'cancelled':
        return 'בוטל';
      default:
        return status;
    }
  };

  const getBillingCycleText = (cycle) => {
    switch (cycle) {
      case 'monthly':
        return 'חודשי';
      case 'yearly':
        return 'שנתי';
      default:
        return cycle;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  const formatAmount = (amount, currency = 'ILS') => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>שגיאה בטעינת המנויים: {error.message}</p>
      </div>
    );
  }

  const filteredSubscriptions = selectedStatus === 'all' 
    ? subscriptions || []
    : (subscriptions || []).filter(sub => sub.status === selectedStatus);

  const groupedSubscriptions = filteredSubscriptions.reduce((groups, subscription) => {
    const status = subscription.status;
    if (!groups[status]) {
      groups[status] = [];
    }
    groups[status].push(subscription);
    return groups;
  }, {});

  return (
    <div className="subscriptions-page">
      <div className="page-header">
        <h1>ניהול מנויים</h1>
        <p className="page-description">
          כאן תוכל לנהל את כל המנויים שזוהו אוטומטיה במערכת
        </p>
      </div>

      <div className="subscriptions-filters">
        <div className="filter-buttons">
          <button
            className={selectedStatus === 'all' ? 'active' : ''}
            onClick={() => setSelectedStatus('all')}
          >
            הכל
          </button>
          <button
            className={selectedStatus === 'active' ? 'active' : ''}
            onClick={() => setSelectedStatus('active')}
          >
            פעילים
          </button>
          <button
            className={selectedStatus === 'pending_approval' ? 'active' : ''}
            onClick={() => setSelectedStatus('pending_approval')}
          >
            ממתינים לאישור
          </button>
          <button
            className={selectedStatus === 'cancelled' ? 'active' : ''}
            onClick={() => setSelectedStatus('cancelled')}
          >
            בוטלו
          </button>
        </div>
      </div>

      <div className="subscriptions-content">
        {selectedStatus === 'all' ? (
          // Show grouped subscriptions
          Object.entries(groupedSubscriptions).map(([status, subs]) => (
            <div key={status} className="subscription-group">
              <h2 className="group-title">
                {getStatusText(status)} ({subs.length})
              </h2>
              <div className="subscriptions-grid">
                {subs.map(subscription => (
                  <SubscriptionCard
                    key={subscription.id}
                    subscription={subscription}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                    onCancel={handleCancel}
                    formatAmount={formatAmount}
                    formatDate={formatDate}
                    getBillingCycleText={getBillingCycleText}
                    getStatusText={getStatusText}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          // Show filtered subscriptions
          <div className="subscriptions-grid">
            {filteredSubscriptions.map(subscription => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                onConfirm={handleConfirm}
                onReject={handleReject}
                onCancel={handleCancel}
                formatAmount={formatAmount}
                formatDate={formatDate}
                getBillingCycleText={getBillingCycleText}
                getStatusText={getStatusText}
              />
            ))}
          </div>
        )}

        {filteredSubscriptions.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔄</div>
            <h3>אין מנויים</h3>
            <p>
              {selectedStatus === 'all' 
                ? 'טרם זוהו מנויים במערכת'
                : `אין מנויים עם סטטוס "${getStatusText(selectedStatus)}"`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Subscription Card Component
const SubscriptionCard = ({ 
  subscription, 
  onConfirm, 
  onReject, 
  onCancel,
  formatAmount,
  formatDate,
  getBillingCycleText,
  getStatusText
}) => {
  return (
    <div className={`subscription-card ${subscription.status}`}>
      <div className="card-header">
        <h3 className="subscription-name">{subscription.name}</h3>
        <span className={`status-badge ${subscription.status}`}>
          {getStatusText(subscription.status)}
        </span>
      </div>

      <div className="card-content">
        <div className="subscription-details">
          <div className="detail-item">
            <span className="label">סכום:</span>
            <span className="value">
              {formatAmount(subscription.amount, subscription.currency)}
            </span>
          </div>
          
          <div className="detail-item">
            <span className="label">תדירות:</span>
            <span className="value">
              {getBillingCycleText(subscription.billing_cycle)}
            </span>
          </div>

          {subscription.next_billing_date && (
            <div className="detail-item">
              <span className="label">חיוב הבא:</span>
              <span className="value">
                {formatDate(subscription.next_billing_date)}
              </span>
            </div>
          )}

          {subscription.category_name && (
            <div className="detail-item">
              <span className="label">קטגוריה:</span>
              <span className="value">{subscription.category_name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-actions">
        {subscription.status === 'pending_approval' && (
          <>
            <button
              className="btn btn-primary"
              onClick={() => onConfirm(subscription.id)}
            >
              אשר מנוי
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onReject(subscription.id)}
            >
              זה לא מנוי
            </button>
          </>
        )}

        {subscription.status === 'active' && (
          <button
            className="btn btn-danger"
            onClick={() => onCancel(subscription.id)}
          >
            בטל מנוי
          </button>
        )}
      </div>
    </div>
  );
};

export default Subscriptions;