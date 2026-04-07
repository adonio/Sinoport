import AlertOutlined from '@ant-design/icons/AlertOutlined';
import DashboardOutlined from '@ant-design/icons/DashboardOutlined';
import ExportOutlined from '@ant-design/icons/ExportOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import ImportOutlined from '@ant-design/icons/ImportOutlined';

const icons = {
  AlertOutlined,
  DashboardOutlined,
  ExportOutlined,
  FileTextOutlined,
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
          title: '看板',
          type: 'item',
          url: '/station/inbound'
        },
        {
          id: 'station-inbound-flights',
          title: '航班管理',
          type: 'item',
          url: '/station/inbound/flights'
        },
        {
          id: 'station-inbound-mobile',
          title: '手机理货',
          type: 'item',
          url: '/station/inbound/mobile'
        },
        {
          id: 'station-inbound-waybills',
          title: '提单管理',
          type: 'item',
          url: '/station/inbound/waybills'
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
          title: '看板',
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
      id: 'station-files',
      title: '文件中心',
      type: 'item',
      url: '/station/files',
      icon: icons.FileTextOutlined
    },
    {
      id: 'station-exceptions',
      title: '异常中心',
      type: 'item',
      url: '/station/exceptions',
      icon: icons.AlertOutlined
    }
  ]
};

export default station;
