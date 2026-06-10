import { Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import AddTransaction from './AddTransaction'
import Stats from './Stats'
import Accounts from './Accounts'
import Budgets from './Budgets'
import Recurring from './Recurring'
import Debts from './Debts'
import SavingsGoals from './SavingsGoals'
import Books from './Books'
import Categories from './Categories'
import DataIO from './DataIO'
import AssetTrend from './AssetTrend'

export default function AccountingIndex() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/add" element={<AddTransaction />} />
      <Route path="/edit/:id" element={<AddTransaction />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/budgets" element={<Budgets />} />
      <Route path="/recurring" element={<Recurring />} />
      <Route path="/debts" element={<Debts />} />
      <Route path="/savings" element={<SavingsGoals />} />
      <Route path="/books" element={<Books />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/data" element={<DataIO />} />
      <Route path="/trend" element={<AssetTrend />} />
    </Routes>
  )
}
