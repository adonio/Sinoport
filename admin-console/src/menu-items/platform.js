import ApartmentOutlined from '@ant-design/icons/ApartmentOutlined';
import AuditOutlined from '@ant-design/icons/AuditOutlined';
import BarChartOutlined from '@ant-design/icons/BarChartOutlined';
import DashboardOutlined from '@ant-design/icons/DashboardOutlined';
import EnvironmentOutlined from '@ant-design/icons/EnvironmentOutlined';
import ProfileOutlined from '@ant-design/icons/ProfileOutlined';
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined';

const icons = {
  ApartmentOutlined,
  AuditOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  ProfileOutlined
};

const platform = {
  id: 'platform-group',
  title: 'Platform Console',
  type: 'group',
  children: [
    {
      id: 'platform-operations',
      title: 'Operations Center',
      type: 'item',
      url: '/platform/operations',
      icon: icons.DashboardOutlined
    },
    {
      id: 'platform-stations',
      title: 'Stations and Resources',
      type: 'collapse',
      url: '/platform/stations',
      icon: icons.ApartmentOutlined,
      children: [
        { id: 'platform-stations-overview', title: 'Overview', type: 'item', url: '/platform/stations' },
        { id: 'platform-stations-capabilities', title: 'Capability Matrix', type: 'item', url: '/platform/stations/capabilities' },
        { id: 'platform-stations-teams', title: 'Team Mapping', type: 'item', url: '/platform/stations/teams' },
        { id: 'platform-stations-zones', title: 'Zone Mapping', type: 'item', url: '/platform/stations/zones' },
        { id: 'platform-stations-devices', title: 'Device Mapping', type: 'item', url: '/platform/stations/devices' }
      ]
    },
    {
      id: 'platform-network',
      title: 'Network and Lanes',
      type: 'collapse',
      url: '/platform/network',
      icon: icons.EnvironmentOutlined,
      children: [
        { id: 'platform-network-overview', title: 'Overview', type: 'item', url: '/platform/network' },
        { id: 'platform-network-lanes', title: 'Lane Templates', type: 'item', url: '/platform/network/lanes' },
        { id: 'platform-network-scenarios', title: 'Standard Scenarios', type: 'item', url: '/platform/network/scenarios' }
      ]
    },
    {
      id: 'platform-rules',
      title: 'Rules and Orchestration',
      type: 'item',
      url: '/platform/rules',
      icon: icons.ProfileOutlined
    },
    {
      id: 'platform-master-data',
      title: 'Master Data and Integration',
      type: 'collapse',
      url: '/platform/master-data',
      icon: icons.DatabaseOutlined,
      children: [
        { id: 'platform-master-data-overview', title: 'Overview', type: 'item', url: '/platform/master-data' },
        { id: 'platform-master-data-sync', title: 'Sync Board', type: 'item', url: '/platform/master-data/sync' },
        { id: 'platform-master-data-jobs', title: 'Import Jobs', type: 'item', url: '/platform/master-data/jobs' },
        { id: 'platform-master-data-relationships', title: 'Object Relationships', type: 'item', url: '/platform/master-data/relationships' }
      ]
    },
    {
      id: 'platform-audit',
      title: 'Audit and Trust',
      type: 'collapse',
      url: '/platform/audit',
      icon: icons.AuditOutlined,
      children: [
        { id: 'platform-audit-overview', title: 'Overview', type: 'item', url: '/platform/audit' },
        { id: 'platform-audit-events', title: 'Audit Events', type: 'item', url: '/platform/audit/events' },
        { id: 'platform-audit-trust', title: 'Trust Preview', type: 'item', url: '/platform/audit/trust' }
      ]
    },
    {
      id: 'platform-reports',
      title: 'Platform Reports',
      type: 'collapse',
      url: '/platform/reports',
      icon: icons.BarChartOutlined,
      children: [
        { id: 'platform-reports-overview', title: 'Overview', type: 'item', url: '/platform/reports' },
        { id: 'platform-reports-stations', title: 'Station Comparison', type: 'item', url: '/platform/reports/stations' }
      ]
    }
  ]
};

export default platform;
