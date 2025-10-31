import React, { useState } from 'react';
import TransactionReviewModal from '../../components/Upload/TransactionReviewModal';
import SplitTransactionModal from '../../components/Modals/SplitTransactionModal';
import EditTransactionModal from '../../components/Modals/EditTransactionModal';
import DeleteTransactionModal from '../../components/Modals/DeleteTransactionModal';
import CopyTransactionModal from '../../components/Modals/CopyTransactionModal';
import ChangeMonthModal from '../../components/Modals/ChangeMonthModal';
import CategoryTransferModal from '../../components/Modals/CategoryTransferModal';
import MonthlyTargetModal from '../../components/Modals/MonthlyTargetModal';
import MonthlyGoalModal from '../../components/MonthlyGoalModal/MonthlyGoalModal';
import TransactionSearchModal from '../../components/TransactionSearchModal/TransactionSearchModal';
import '../../pages/BusinessCategoryIntelligence/BusinessCategoryIntelligence.css';
import Modal from '../../components/Common/Modal';

const mockTransaction = {
  id: 'tx_1',
  business_name: 'בית קפה לדוגמה',
  amount: -123.4,
  payment_date: new Date().toISOString().split('T')[0],
  category_name: 'מזון ומשקאות',
  currency: 'ILS',
  flow_month: new Date().toISOString().slice(0, 7),
};

const formatCurrency = (amount) => `${Math.round(Number(amount || 0))} ₪`;

const ModalsGallery = () => {
  const [open, setOpen] = useState({});
  const toggle = (key, val = true) => setOpen((s) => ({ ...s, [key]: val }));

  return (
    <div style={{ padding: 24 }} dir="rtl">
      <h1 style={{ marginBottom: 16 }}>Modals Gallery (Preview Only)</h1>
      <p style={{ marginBottom: 24, color: '#666' }}>
        הכפתורים פותחים תצוגת מודל לצורך עיצוב בלבד. אין פעולות אמיתיות.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        <button onClick={() => toggle('TransactionReviewModal')}>TransactionReviewModal</button>
        <button onClick={() => toggle('SplitTransactionModal')}>SplitTransactionModal</button>
        <button onClick={() => toggle('EditTransactionModal')}>EditTransactionModal</button>
        <button onClick={() => toggle('DeleteTransactionModal')}>DeleteTransactionModal</button>
        <button onClick={() => toggle('CopyTransactionModal')}>CopyTransactionModal</button>
        <button onClick={() => toggle('ChangeMonthModal')}>ChangeMonthModal</button>
        <button onClick={() => toggle('CategoryTransferModal')}>CategoryTransferModal</button>
        <button onClick={() => toggle('MonthlyTargetModal')}>MonthlyTargetModal</button>
        <button onClick={() => toggle('MonthlyGoalModal')}>MonthlyGoalModal</button>
        <button onClick={() => toggle('TransactionSearchModal')}>TransactionSearchModal</button>
        <button onClick={() => toggle('TransactionActionsModal')}>TransactionActionsModal</button>
        <button onClick={() => toggle('BCITransactionModal')}>BCI Transaction Modal</button>
        <button onClick={() => toggle('BCISpecificTransactionsModal')}>BCI Specific Transactions Modal</button>
        <button onClick={() => toggle('BaseModal')}>Base Modal (Generic)</button>
      </div>

      {/* Actual modals wired with mock/no-op handlers */}
      <TransactionReviewModal
        isOpen={!!open.TransactionReviewModal}
        onClose={() => toggle('TransactionReviewModal', false)}
        onConfirm={() => toggle('TransactionReviewModal', false)}
        transactions={[]}
        cashFlowId={null}
      />

      <SplitTransactionModal
        isOpen={!!open.SplitTransactionModal}
        onClose={() => toggle('SplitTransactionModal', false)}
        transaction={mockTransaction}
        onSplit={() => Promise.resolve({ success: true })}
      />

      <EditTransactionModal
        isOpen={!!open.EditTransactionModal}
        onClose={() => toggle('EditTransactionModal', false)}
        transaction={mockTransaction}
        onSave={() => Promise.resolve()}
      />

      <DeleteTransactionModal
        isOpen={!!open.DeleteTransactionModal}
        onClose={() => toggle('DeleteTransactionModal', false)}
        transaction={mockTransaction}
        onDelete={() => Promise.resolve()}
      />

      <CopyTransactionModal
        isOpen={!!open.CopyTransactionModal}
        onClose={() => toggle('CopyTransactionModal', false)}
        transaction={mockTransaction}
        onCopy={() => Promise.resolve()}
      />

      <ChangeMonthModal
        isOpen={!!open.ChangeMonthModal}
        onClose={() => toggle('ChangeMonthModal', false)}
        transaction={mockTransaction}
        onChangeMonth={() => Promise.resolve()}
      />

      <CategoryTransferModal
        isOpen={!!open.CategoryTransferModal}
        onClose={() => toggle('CategoryTransferModal', false)}
        transaction={mockTransaction}
        onTransfer={() => Promise.resolve()}
      />

      <MonthlyTargetModal
        isOpen={!!open.MonthlyTargetModal}
        onClose={() => toggle('MonthlyTargetModal', false)}
        categoryName="קטגוריה לדוגמה"
        currentTarget={450}
        formatCurrency={formatCurrency}
        onTargetUpdated={() => {}}
        isIncome={false}
      />

      <MonthlyGoalModal
        isOpen={!!open.MonthlyGoalModal}
        onClose={() => toggle('MonthlyGoalModal', false)}
        onSave={() => Promise.resolve()}
        cashFlowId={null}
        year={new Date().getFullYear()}
        month={new Date().getMonth() + 1}
      />

      <TransactionSearchModal
        isOpen={!!open.TransactionSearchModal}
        onClose={() => toggle('TransactionSearchModal', false)}
      />

      {/* TransactionActionsModal: render minimal imitation for preview */}
      {open.TransactionActionsModal && (
        <div className="modal-backdrop" onClick={() => toggle('TransactionActionsModal', false)}>
          <div className="transaction-actions-modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>פעולות לדוגמה</h3>
              <button className="close-btn" onClick={() => toggle('TransactionActionsModal', false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">תוכן תצוגה בלבד</div>
          </div>
        </div>
      )}

      {/* Base Modal (Generic Style Showcase) */}
      {open.BaseModal && (
        <Modal
          isOpen={true}
          onClose={() => toggle('BaseModal', false)}
          title="מודל כללי לדוגמה"
          size="medium"
          footer={(
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => toggle('BaseModal', false)}>ביטול</button>
              <button className="btn btn-primary" onClick={() => toggle('BaseModal', false)}>אישור</button>
            </div>
          )}
        >
          <div className="modal-body">
            זהו מודל לדוגמה שמציג את העיצוב הכללי (כותרת, גוף ותחתית).
          </div>
        </Modal>
      )}

      {/* BCI Transaction Modal placeholder */}
      {open.BCITransactionModal && (
        <div className="bci-modal-overlay" onClick={() => toggle('BCITransactionModal', false)}>
          <div className="bci-transaction-modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="bci-modal-header">
              <h3>עסקאות של עסק לדוגמה</h3>
              <button className="bci-close-btn" onClick={() => toggle('BCITransactionModal', false)}>×</button>
            </div>
            <div className="bci-modal-content" style={{ padding: 16 }}>
              תוכן תצוגה בלבד (BCI)
            </div>
          </div>
        </div>
      )}

      {/* BCI Specific Transactions placeholder */}
      {open.BCISpecificTransactionsModal && (
        <div className="modal-overlay" onClick={() => toggle('BCISpecificTransactionsModal', false)}>
          <div className="specific-transactions-modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>בחירת רשומות - לדוגמה</h3>
              <button className="close-btn" onClick={() => toggle('BCISpecificTransactionsModal', false)}>×</button>
            </div>
            <div className="modal-content" style={{ padding: 16 }}>
              תוכן תצוגה בלבד (BCI Specific)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModalsGallery;
