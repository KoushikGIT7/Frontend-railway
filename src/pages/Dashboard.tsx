import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardCard from '../components/ui/DashboardCard';
import ChartContainer from '../components/charts/ChartContainer';
import { DashboardCard as CardType } from '../types';
import { Package, Truck, CheckCircle, Settings, Eye, Edit } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [manufacturerData, setManufacturerData] = useState({
    totalOrders: 47,
    inProduction: 12,
    dispatched: 18,
    delivered: 456
  });

  // Load real-time data for manufacturer
  useEffect(() => {
    if (user?.role === 'manufacturer') {
      loadManufacturerData();
    }
  }, [user?.role]);

  const loadManufacturerData = async () => {
    try {
      // Try to load real data from Firestore
      const response = await fetch('/api/getProductsFast');
      if (response.ok) {
        const data = await response.json();
        if (data.products && data.products.length > 0) {
          const orders = data.products;
          const totalOrders = orders.length;
          const inProduction = orders.filter((o: any) => o.status === 'manufactured' || o.status === 'in_production').length;
          const dispatched = orders.filter((o: any) => o.status === 'dispatched').length;
          const delivered = orders.filter((o: any) => o.status === 'delivered').length;
          
          setManufacturerData({
            totalOrders,
            inProduction,
            dispatched,
            delivered
          });
        }
      }
    } catch (error) {
      console.log('Using mock data for manufacturer dashboard');
    }
  };

  if (!user) return null;

  // Role-specific dashboard data
  const getCardsForRole = (): CardType[] => {
    switch (user.role) {
      case 'admin':
        return [
          { title: 'Total Users', value: '1,234', change: '+12%', changeType: 'positive', icon: 'Users' },
          { title: 'System Approvals', value: '856', change: '+5%', changeType: 'positive', icon: 'CheckCircle' },
          { title: 'Blockchain Logs', value: '45,678', change: '+8%', changeType: 'positive', icon: 'Shield' },
          { title: 'AI Analytics Score', value: '94.2', change: '+2.1', changeType: 'positive', icon: 'Brain' },
        ];
      case 'drm':
        return [
          { title: 'Division Inspections', value: '234', change: '+7%', changeType: 'positive', icon: 'Search' },
          { title: 'Pending Approvals', value: '12', change: '-3', changeType: 'negative', icon: 'Clock' },
          { title: 'Product Performance', value: '92%', change: '+3%', changeType: 'positive', icon: 'TrendingUp' },
          { title: 'AI Manufacturer Rating', value: '88.5', change: '+1.2', changeType: 'positive', icon: 'Star' },
        ];
      case 'sr_den':
        return [
          { title: 'Sub-Division Projects', value: '18', change: '+2', changeType: 'positive', icon: 'BarChart3' },
          { title: 'Pending Approvals', value: '8', change: '0', changeType: 'neutral', icon: 'Clock' },
          { title: 'DEN Performance', value: '91%', change: '+4%', changeType: 'positive', icon: 'Users' },
          { title: 'AI Insights Score', value: '89.3', change: '+2.8', changeType: 'positive', icon: 'Brain' },
        ];
      case 'den':
        return [
          { title: 'Section Approvals', value: '15', change: '+3', changeType: 'positive', icon: 'CheckCircle' },
          { title: 'Active Tasks', value: '28', change: '+5', changeType: 'positive', icon: 'UserPlus' },
          { title: 'Inspection Logs', value: '142', change: '+12%', changeType: 'positive', icon: 'FileText' },
          { title: 'Section Performance', value: '87%', change: '+2%', changeType: 'positive', icon: 'Activity' },
        ];
      case 'inspector':
        return [
          { title: 'Assigned Sections', value: '6', change: '+1', changeType: 'positive', icon: 'MapPin' },
          { title: 'Inspections Today', value: '8', change: '+2', changeType: 'positive', icon: 'CheckCircle' },
          { title: 'Products Scanned', value: '45', change: '+12', changeType: 'positive', icon: 'QrCode' },
          { title: 'Blockchain Records', value: '156', change: '+8%', changeType: 'positive', icon: 'Shield' },
        ];
      case 'manufacturer':
        return [
          { title: 'Total Orders', value: manufacturerData.totalOrders.toString(), change: '+6', changeType: 'positive', icon: 'ShoppingCart' },
          { title: 'In Production', value: manufacturerData.inProduction.toString(), change: '+3', changeType: 'positive', icon: 'Settings' },
          { title: 'Dispatched', value: manufacturerData.dispatched.toString(), change: '+5', changeType: 'positive', icon: 'Truck' },
          { title: 'Delivered', value: manufacturerData.delivered.toString(), change: '+8%', changeType: 'positive', icon: 'CheckCircle' },
        ];
      default:
        return [];
    }
  };

  const getChartsForRole = () => {
    const baseCharts = [
      {
        type: 'bar' as const,
        title: user.role === 'admin' ? 'System Activity' : 
               user.role === 'drm' ? 'Division Inspections' :
               user.role === 'sr_den' ? 'Project Progress' :
               user.role === 'den' ? 'Section Tasks' :
               user.role === 'inspector' ? 'Daily Inspections' :
               'Monthly Orders',
        data: [
          { name: 'Jan', value: 120 },
          { name: 'Feb', value: 98 },
          { name: 'Mar', value: 134 },
          { name: 'Apr', value: 156 },
          { name: 'May', value: 142 },
          { name: 'Jun', value: 178 },
        ]
      },
      {
        type: 'line' as const,
        title: user.role === 'admin' ? 'System Performance' :
               user.role === 'drm' ? 'Division Performance' :
               user.role === 'sr_den' ? 'Sub-Division Efficiency' :
               user.role === 'den' ? 'Section Efficiency' :
               user.role === 'inspector' ? 'Inspection Quality' :
               'Product Performance',
        data: [
          { name: 'Week 1', value: 85 },
          { name: 'Week 2', value: 88 },
          { name: 'Week 3', value: 92 },
          { name: 'Week 4', value: 89 },
          { name: 'Week 5', value: 95 },
          { name: 'Week 6', value: 93 },
        ]
      }
    ];

    if (user.role === 'admin' || user.role === 'drm') {
      baseCharts.push({
        type: 'pie' as const,
        title: user.role === 'admin' ? 'User Distribution' : 'Division Status',
        data: [
          { name: 'Active', value: 65 },
          { name: 'Pending', value: 20 },
          { name: 'Completed', value: 15 },
        ]
      });
    }

    return baseCharts;
  };

  const cards = getCardsForRole();
  const charts = getChartsForRole();

  const getRoleTitle = () => {
    switch (user.role) {
      case 'admin': return 'Administrator';
      case 'drm': return 'Divisional Railway Manager';
      case 'sr_den': return 'Senior Divisional Engineer';
      case 'den': return 'Divisional Engineer';
      case 'inspector': return 'Field Inspector';
      case 'manufacturer': return 'Manufacturer';
      default: return 'User';
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {user.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {getRoleTitle()} Dashboard
        </p>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <DashboardCard key={index} {...card} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {charts.map((chart, index) => (
          <ChartContainer
            key={index}
            type={chart.type}
            data={chart.data}
            title={chart.title}
            height={300}
          />
        ))}
      </div>

      {/* Quick Actions for Manufacturer */}
      {user.role === 'manufacturer' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <Package className="h-6 w-6 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-blue-900 dark:text-blue-200">View Orders</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">Manage orders</p>
              </div>
            </button>
            <button className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              <Settings className="h-6 w-6 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-green-900 dark:text-green-200">Start Production</p>
                <p className="text-sm text-green-700 dark:text-green-300">Begin manufacturing</p>
              </div>
            </button>
            <button className="flex items-center space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
              <Truck className="h-6 w-6 text-purple-600" />
              <div className="text-left">
                <p className="font-medium text-purple-900 dark:text-purple-200">Dispatch</p>
                <p className="text-sm text-purple-700 dark:text-purple-300">Send products</p>
              </div>
            </button>
            <button className="flex items-center space-x-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
              <CheckCircle className="h-6 w-6 text-orange-600" />
              <div className="text-left">
                <p className="font-medium text-orange-900 dark:text-orange-200">Mark Delivered</p>
                <p className="text-sm text-orange-700 dark:text-orange-300">Confirm delivery</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {user.role === 'admin' && [
            { action: 'User created', item: 'New Inspector Account', time: '2 hours ago' },
            { action: 'System audit completed', item: 'Blockchain verification', time: '4 hours ago' },
            { action: 'Report generated', item: 'Monthly system usage', time: '6 hours ago' },
            { action: 'Role updated', item: 'DEN permissions modified', time: '8 hours ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{activity.item}</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{activity.time}</span>
            </div>
          ))}
          
          {user.role === 'drm' && [
            { action: 'Approval processed', item: 'High-value product request', time: '1 hour ago' },
            { action: 'Division report generated', item: 'Monthly inspection summary', time: '3 hours ago' },
            { action: 'User added', item: 'New Sr. DEN account', time: '5 hours ago' },
            { action: 'AI analysis completed', item: 'Manufacturer performance rating', time: '7 hours ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{activity.item}</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{activity.time}</span>
            </div>
          ))}

          {user.role === 'sr_den' && [
            { action: 'Project approved', item: 'Track modernization - Section A', time: '2 hours ago' },
            { action: 'DEN request processed', item: 'Budget approval for maintenance', time: '4 hours ago' },
            { action: 'Inspection reviewed', item: 'Field Inspector report verified', time: '6 hours ago' },
            { action: 'Sub-division report', item: 'Monthly performance summary', time: '8 hours ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{activity.item}</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{activity.time}</span>
            </div>
          ))}

          {user.role === 'den' && [
            { action: 'Task assigned', item: 'Track inspection to AEN Kumar', time: '1 hour ago' },
            { action: 'Approval granted', item: 'Product request from Inspector', time: '3 hours ago' },
            { action: 'Inspection log reviewed', item: 'Section A-123 maintenance', time: '5 hours ago' },
            { action: 'Section report generated', item: 'Weekly status summary', time: '7 hours ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{activity.item}</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{activity.time}</span>
            </div>
          ))}

          {user.role === 'inspector' && [
            { action: 'Product scanned', item: 'Rail Joint RJ-456', time: '30 minutes ago' },
            { action: 'Inspection recorded', item: 'Track Section A-123', time: '2 hours ago' },
            { action: 'Product requested', item: 'Additional fasteners for Section B', time: '4 hours ago' },
            { action: 'Blockchain verified', item: 'Inspection data recorded', time: '6 hours ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{activity.item}</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{activity.time}</span>
            </div>
          ))}

          {user.role === 'manufacturer' && [
            { action: 'Order processed', item: 'Rail joints batch RJ-2024-001', time: '1 hour ago' },
            { action: 'Inventory updated', item: 'Track bolts stock replenished', time: '3 hours ago' },
            { action: 'Delivery completed', item: '500 sleepers to Mumbai Division', time: '5 hours ago' },
            { action: 'AI rating updated', item: 'Performance score: 91.2/100', time: '7 hours ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{activity.item}</p>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;