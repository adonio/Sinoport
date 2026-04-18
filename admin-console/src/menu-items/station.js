import AlertOutlined from '@ant-design/icons/AlertOutlined';
import BarChartOutlined from '@ant-design/icons/BarChartOutlined';
import DashboardOutlined from '@ant-design/icons/DashboardOutlined';
import ExportOutlined from '@ant-design/icons/ExportOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import ImportOutlined from '@ant-design/icons/ImportOutlined';
import IdcardOutlined from '@ant-design/icons/IdcardOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';

const icons = {
  AlertOutlined,
  BarChartOutlined,
  DashboardOutlined,
  ExportOutlined,
  FileTextOutlined,
  IdcardOutlined,
  ImportOutlined
};

const station = {
  id: 'station-group',
  title: '货站后台',
  type: 'group',
  children: [
    {
      id: 'station-dashboard',
      title: '货站看板',
      type: 'item',
      url: '/station/dashboard',
      icon: icons.DashboardOutlined
    },
    {
      id: 'station-inbound',
      title: '进港管理',
      type: 'collapse',
      url: '/station/inbound',
      icon: icons.ImportOutlined,
      children: [
        {
          id: 'station-inbound-overview',
          title: '总览',
          type: 'item',
          url: '/station/inbound'
        },
        {
          id: 'station-inbound-flights',
          title: '航班管理',
          type: 'item',
          url: '/station/inbound/flights',
          matchPrefix: true
        },
        {
          id: 'station-inbound-waybills',
          title: '提单管理',
          type: 'item',
          url: '/station/inbound/waybills'
        },
        {
          id: 'station-inbound-mobile',
          title: 'PDA 作业终端',
          type: 'item',
          url: '/station/inbound/mobile'
        }
      ]
    },
    {
      id: 'station-outbound',
      title: '出港管理',
      type: 'collapse',
      url: '/station/outbound',
      icon: icons.ExportOutlined,
      children: [
        {
          id: 'station-outbound-overview',
          title: '总览',
          type: 'item',
          url: '/station/outbound'
        },
        {
          id: 'station-outbound-flights',
          title: '航班管理',
          type: 'item',
          url: '/station/outbound/flights'
        },
        {
          id: 'station-outbound-waybills',
          title: '提单管理',
          type: 'item',
          url: '/station/outbound/waybills'
        }
      ]
    },
    {
      id: 'station-shipments',
      title: '提单与履约链路',
      type: 'item',
      url: '/station/shipments',
      matchPrefix: true,
      icon: icons.IdcardOutlined
    },
    {
      id: 'station-documents',
      title: '单证与指令中心',
      type: 'collapse',
      url: '/station/documents',
      icon: icons.FileTextOutlined,
      children: [
        { id: 'station-documents-overview', title: '总览', type: 'item', url: '/station/documents' },
        { id: 'station-documents-noa', title: 'NOA 通知动作', type: 'item', url: '/station/documents/noa' },
        { id: 'station-documents-pod', title: 'POD 补签动作', type: 'item', url: '/station/documents/pod' }
      ]
    },
    {
      id: 'station-tasks',
      title: '作业指令中心',
      type: 'item',
      url: '/station/tasks',
      icon: icons.DashboardOutlined
    },
    {
      id: 'station-copilot',
      title: 'Copilot 交互层',
      type: 'item',
      url: '/station/copilot',
      icon: MessageOutlined
    },
    {
      id: 'station-resources',
      title: '班组 / 区位 / 设备管理',
      type: 'collapse',
      url: '/station/resources',
      icon: icons.IdcardOutlined,
      children: [
        { id: 'station-resources-overview', title: '总览', type: 'item', url: '/station/resources' },
        { id: 'station-resources-teams', title: '班组与人员', type: 'item', url: '/station/resources/teams' },
        { id: 'station-resources-zones', title: '区位与 Dock', type: 'item', url: '/station/resources/zones' },
        { id: 'station-resources-devices', title: 'PDA 设备绑定', type: 'item', url: '/station/resources/devices' },
        { id: 'station-resources-vehicles', title: '车辆与 Collection Note', type: 'item', url: '/station/resources/vehicles' }
      ]
    },
    {
      id: 'station-exceptions',
      title: '异常中心',
      type: 'collapse',
      url: '/station/exceptions',
      icon: icons.AlertOutlined,
      children: [
        { id: 'station-exceptions-overview', title: '总览', type: 'item', url: '/station/exceptions' },
        { id: 'station-exceptions-detail-demo', title: '异常详情示例', type: 'item', url: '/station/exceptions/EXP-0408-001' }
      ]
    },
    {
      id: 'station-reports',
      title: '货站层报表',
      type: 'collapse',
      url: '/station/reports',
      icon: icons.BarChartOutlined,
      children: [
        { id: 'station-reports-overview', title: '总览', type: 'item', url: '/station/reports' },
        { id: 'station-reports-shift', title: '班次报表', type: 'item', url: '/station/reports/shift' }
      ]
    }
  ]
};

export default station;
