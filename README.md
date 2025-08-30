# BudgetLens - Personal Finance Management App 💰

<div align="center">

![BudgetLens](https://img.shields.io/badge/BudgetLens-Personal%20Finance-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![Supabase](https://img.shields.io/badge/Supabase-Database-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

**A comprehensive personal finance management application with advanced transaction tracking, stock portfolio management, and intelligent categorization.**

[Demo](#demo) • [Features](#features) • [Installation](#installation) • [Usage](#usage) • [API](#api) • [Contributing](#contributing)

</div>

---

## 📊 Demo

BudgetLens helps you take control of your personal finances with:
- 🏦 **Bank Integration** - Import transactions from Israeli banks
- 📈 **Stock Portfolio** - Track your investments and performance  
- 🏷️ **Smart Categorization** - AI-powered transaction categorization
- 📱 **Responsive Design** - Works on desktop and mobile
- 🔒 **Secure & Private** - Your data stays protected

---

## ✨ Features

### 💳 Transaction Management
- **File Upload**: Import Excel/CSV files from banks and credit cards
- **Duplicate Detection**: Intelligent duplicate handling with replace/create options
- **Transaction Splitting**: Split transactions across multiple categories
- **PAYBOX Integration**: Automatic recipient name extraction from PAYBOX transfers
- **Bulk Operations**: Multi-select transactions for batch operations

### 📊 Financial Analysis
- **Dashboard Overview**: Visual summary of income, expenses, and balance
- **Category Breakdown**: Detailed expense analysis by category
- **Monthly Tracking**: Navigate between months with cumulative views
- **Custom Reports**: Generate detailed financial reports
- **Goal Setting**: Set and track monthly financial goals

### 📈 Stock Portfolio
- **Portfolio Tracking**: Monitor your stock investments
- **Real-time Prices**: Get current stock prices and performance
- **Trade History**: Track buy/sell transactions
- **Watchlist**: Keep an eye on stocks of interest
- **Price Alerts**: Get notified when stocks hit target prices

### 🔐 User Management
- **Secure Authentication**: JWT-based authentication with Supabase
- **User Profiles**: Manage personal information and preferences
- **Password Reset**: Secure password recovery via email
- **Email Verification**: Verify email addresses for security

### 🛠️ Advanced Features
- **Israeli Bank Integration**: Support for major Israeli banks using israeli-bank-scrapers
- **Multi-currency Support**: Handle transactions in different currencies
- **Category Mapping**: Auto-categorize transactions based on patterns
- **Data Export**: Export your data in various formats
- **Responsive UI**: Clean, modern interface that works on all devices

---

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Supabase account

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/your-username/budget_app_project.git
cd budget_app_project
```

2. **Install dependencies**
```bash
npm install
npm run client:install
```

3. **Environment Setup**
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
JWT_SECRET=your_jwt_secret
NODE_ENV=development
PORT=5001
```

4. **Database Setup**
Run the SQL migration files in the `sql/` directory in your Supabase dashboard.

5. **Start the application**
```bash
# Development mode (runs both client and server)
npm run dev

# Production mode
npm run build
npm start
```

The application will be available at:
- Frontend: http://localhost:4000
- Backend API: http://localhost:5001

---

## 📋 Usage

### Getting Started
1. **Register** a new account or **login** with existing credentials
2. **Upload** your bank statements (Excel/CSV format)
3. **Review** and categorize your transactions
4. **Set goals** and track your financial progress
5. **Analyze** your spending patterns with visual charts

### Importing Transactions
1. Navigate to **Upload** page
2. Select your bank statement file (Excel/CSV)
3. Map columns to transaction fields
4. Review duplicates and choose actions
5. Confirm and import transactions

### Managing Categories
- **Category Order**: Customize the display order in `/category-order`
- **Category Mapping**: Set up automatic categorization rules in `/category-mappings`
- **Monthly Targets**: Set spending targets for each category

---

## 🔧 API Endpoints

### Authentication
```
POST /api/auth/register     - Register new user
POST /api/auth/login        - User login
POST /api/auth/logout       - User logout
POST /api/auth/reset-password - Password reset
```

### Transactions
```
GET    /api/transactions              - Get all transactions
POST   /api/transactions              - Create transaction
PUT    /api/transactions/:id          - Update transaction
DELETE /api/transactions/:id          - Delete transaction
POST   /api/transactions/split        - Split transaction
```

### Categories
```
GET    /api/categories         - Get all categories
POST   /api/categories         - Create category
PUT    /api/categories/:id     - Update category
DELETE /api/categories/:id     - Delete category
```

### Upload
```
POST   /api/upload                    - Upload file
POST   /api/upload/finalize           - Finalize import
POST   /api/upload/check-duplicates   - Check for duplicates
```

### Stocks
```
GET    /api/stocks                    - Get stock data
POST   /api/stocks/transactions       - Add stock transaction
GET    /api/stocks/portfolio          - Get portfolio summary
```

---

## 🏗️ Project Structure

```
budget_app_project/
├── client/                    # React frontend application
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/           # Page components
│   │   ├── contexts/        # React contexts
│   │   ├── services/        # API service functions
│   │   └── utils/           # Utility functions
├── server/                   # Node.js backend application
│   ├── routes/              # Express route handlers
│   ├── services/            # Business logic services
│   ├── middleware/          # Express middleware
│   ├── config/              # Configuration files
│   └── utils/               # Server utilities
├── sql/                     # Database migration scripts
├── docs/                    # Project documentation
└── netlify/                 # Netlify Functions (for deployment)
```

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Chart.js** - Data visualization
- **React Query** - Data fetching and caching
- **React Hook Form** - Form management
- **React Hot Toast** - Notifications

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Supabase** - Database and authentication
- **JWT** - Authentication tokens
- **Multer** - File upload handling
- **XLSX** - Excel file processing
- **israeli-bank-scrapers** - Bank integration

### Database
- **Supabase/PostgreSQL** - Main database
- **Row Level Security** - Data protection
- **Real-time subscriptions** - Live data updates

### Deployment
- **Netlify** - Frontend and serverless functions
- **Supabase** - Database hosting
- **GitHub Actions** - CI/CD (optional)

---

## 🌍 Localization

The application supports:
- **Hebrew** - Primary language for Israeli users
- **English** - Secondary language support
- **RTL Layout** - Right-to-left text direction
- **Local Date Formats** - Hebrew calendar integration

---

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Row Level Security** - Database-level access control
- **Input Validation** - Server and client-side validation
- **Rate Limiting** - API request throttling
- **CORS Protection** - Cross-origin request security
- **Helmet.js** - Security headers
- **bcrypt** - Password hashing

---

## 📈 Performance

- **Code Splitting** - Lazy loading of components
- **Caching** - API response caching with React Query
- **Compression** - Gzip compression for assets
- **CDN Ready** - Static assets optimized for CDN
- **Database Indexing** - Optimized queries with proper indexes

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards
- Use ESLint and Prettier for code formatting
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Documentation](docs/)
2. Search [Issues](https://github.com/your-username/budget_app_project/issues)
3. Create a new issue if needed

---

## 🎯 Roadmap

### Upcoming Features
- [ ] Mobile app (React Native)
- [ ] Advanced analytics and insights
- [ ] Budget forecasting with AI
- [ ] Multi-user support for families
- [ ] Integration with more banks
- [ ] Cryptocurrency tracking
- [ ] Receipt scanning with OCR

### Recent Updates
- ✅ PAYBOX recipient name extraction
- ✅ Intelligent duplicate handling
- ✅ Transaction splitting functionality
- ✅ Stock portfolio tracking
- ✅ Israeli bank integration

---

<div align="center">

**Made with ❤️ for better financial management**

[⬆ Back to top](#budgetlens---personal-finance-management-app-)

</div>