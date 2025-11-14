import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { DemoProvider } from './contexts/DemoContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import VerifyEmail from './pages/Auth/VerifyEmail';
import Dashboard from './pages/Dashboard/Dashboard';
import Transactions from './pages/Transactions/Transactions';
import TransactionDetails from './pages/TransactionDetails/TransactionDetails';
import Upload from './pages/Upload/Upload';
import FileMerger from './pages/Upload/FileMerger';
import BankScraperApiSetup from './pages/Upload/BankScraperApiSetup';
import Reports from './pages/Reports/Reports';
import Profile from './pages/Profile/Profile';
import StocksDashboard from './pages/Stocks/StocksDashboard';
import StockChart from './pages/Stocks/StockChart';
import StockTransactions from './pages/Stocks/StockTransactions';
import Alerts from './pages/Stocks/Alerts';
import CategoryOrder from './pages/CategoryOrder/CategoryOrder';
import CategoryMappings from './pages/CategoryMappings/CategoryMappings';
import BusinessCategoryIntelligence from './pages/BusinessCategoryIntelligence/BusinessCategoryIntelligence';
import CashFlowDashboard from './pages/CashFlow/CashFlowDashboard';
import CashFlowManagement from './pages/CashFlow/CashFlowManagement';
import BudgetLensComparison from './pages/BudgetLensComparison/BudgetLensComparison';
import BankScraperPage from './components/BankScraper/BankScraperPage';
import DemoDashboard from './components/Demo/DemoDashboard';
import ModalsGallery from './pages/ModalsGallery/ModalsGallery';
import './styles/stocks.css';
import LoadingSpinner from './components/Common/LoadingSpinner';

function App() {
  const { user, loading } = useAuth();
  const BANK_SCRAPER_OWNER_ID = 'e3f6919b-d83b-4456-8325-676550a4382d';

  if (loading) {
    return (
      <div className="loading">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <DemoProvider>
      <Routes>
        {/* Demo routes - accessible without authentication */}
        <Route path="/demo/dashboard" element={<DemoDashboard />} />
        
        {/* Auth routes */}
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login />
        } />
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" replace /> : <Register />
        } />
        <Route path="/forgot-password" element={
          user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />
        } />
        <Route path="/reset-password" element={
          user ? <Navigate to="/dashboard" replace /> : <ResetPassword />
        } />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email-change" element={<VerifyEmail />} />
        
        {/* Protected routes */}
        <Route path="/" element={
          user ? <Layout /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cash-flow" element={<CashFlowDashboard />} />
          <Route path="cash-flow/manage" element={<CashFlowManagement />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="transaction/:id" element={<TransactionDetails />} />
          <Route path="upload" element={<Upload />} />
          <Route path="upload/file-merger" element={<FileMerger />} />
          <Route
            path="upload/bank-scraper-api"
            element={
              user?.id === BANK_SCRAPER_OWNER_ID
                ? <BankScraperApiSetup />
                : <Navigate to="/upload" replace />
            }
          />
          <Route path="reports" element={<Reports />} />
          <Route path="profile" element={<Profile />} />
          <Route path="stocks" element={<StocksDashboard />} />
          <Route path="stocks/chart/:symbol" element={<StockChart />} />
          <Route path="stocks/transactions" element={<StockTransactions />} />
          <Route path="stocks/alerts" element={<Alerts />} />
          <Route path="category-order" element={<CategoryOrder />} />
          <Route path="category-mappings" element={<CategoryMappings />} />
          <Route path="business-category-intelligence" element={<BusinessCategoryIntelligence />} />
          <Route path="budgetlens-comparison" element={<BudgetLensComparison />} />
          <Route path="bank-scraper" element={<BankScraperPage />} />
          <Route path="modals-gallery" element={<ModalsGallery />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DemoProvider>
  );
}

export default App;
