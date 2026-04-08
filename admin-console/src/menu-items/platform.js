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
  title: '平台管理后台',
  type: 'group',
  children: [
    {
      id: 'platform-operations',
      title: '运行态势中心',
      type: 'item',
      url: '/platform/operations',
      icon: icons.DashboardOutlined
    },
    {
      id: 'platform-stations',
      title: '货站与资源管理',
      type: 'collapse',
      url: '/platform/stations',
      icon: icons.ApartmentOutlined,
      children: [
        { id: 'platform-stations-overview', title: '总览', type: 'item', url: '/platform/stations' },
        { id: 'platform-stations-capabilities', title: '能力矩阵', type: 'item', url: '/platform/stations/capabilities' },
        { id: 'platform-stations-teams', title: '班组映射', type: 'item', url: '/platform/stations/teams' },
        { id: 'platform-stations-zones', title: '区位映射', type: 'item', url: '/platform/stations/zones' },
        { id: 'platform-stations-devices', title: '设备映射', type: 'item', url: '/platform/stations/devices' }
      ]
    },
    {
      id: 'platform-network',
      title: '航线网络与链路配置',
      type: 'collapse',
      url: '/platform/network',
      icon: icons.EnvironmentOutlined,
      children: [
        { id: 'platform-network-overview', title: '总览', type: 'item', url: '/platform/network' },
        { id: 'platform-network-lanes', title: '链路模板', type: 'item', url: '/platform/network/lanes' },
        { id: 'platform-network-scenarios', title: '标准场景', type: 'item', url: '/platform/network/scenarios' }
      ]
    },
    {
      id: 'platform-rules',
      title: '规则与指令引擎',
      type: 'item',
      url: '/platform/rules',
      icon: icons.ProfileOutlined
    },
    {
      id: 'platform-master-data',
      title: '主数据与接口治理',
      type: 'collapse',
      url: '/platform/master-data',
      icon: icons.DatabaseOutlined,
      children: [
        { id: 'platform-master-data-overview', title: '总览', type: 'item', url: '/platform/master-data' },
        { id: 'platform-master-data-sync', title: '同步看板', type: 'item', url: '/platform/master-data/sync' },
        { id: 'platform-master-data-jobs', title: '导入任务', type: 'item', url: '/platform/master-data/jobs' },
        { id: 'platform-master-data-relationships', title: '对象关系', type: 'item', url: '/platform/master-data/relationships' }
      ]
    },
    {
      id: 'platform-audit',
      title: '审计与可信留痕',
      type: 'collapse',
      url: '/platform/audit',
      icon: icons.AuditOutlined,
      children: [
        { id: 'platform-audit-overview', title: '总览', type: 'item', url: '/platform/audit' },
        { id: 'platform-audit-events', title: '审计事件', type: 'item', url: '/platform/audit/events' },
        { id: 'platform-audit-trust', title: '可信占位', type: 'item', url: '/platform/audit/trust' }
      ]
    },
    {
      id: 'platform-reports',
      title: '平台级报表',
      type: 'collapse',
      url: '/platform/reports',
      icon: icons.BarChartOutlined,
      children: [
        { id: 'platform-reports-overview', title: '总览', type: 'item', url: '/platform/reports' },
        { id: 'platform-reports-stations', title: '站点对比', type: 'item', url: '/platform/reports/stations' }
      ]
    }
  ]
};

export default platform;
