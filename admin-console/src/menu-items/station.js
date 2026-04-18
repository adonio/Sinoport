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
  title: 'Station Console',
  type: 'group',
  children: [
    {
      id: 'station-dashboard',
      title: 'Station Dashboard',
      type: 'item',
      url: '/station/dashboard',
      icon: icons.DashboardOutlined
    },
    {
      id: 'station-inbound',
      title: 'Inbound Operations',
      type: 'collapse',
      url: '/station/inbound',
      icon: icons.ImportOutlined,
      children: [
        {
          id: 'station-inbound-overview',
          title: 'Overview',
          type: 'item',
          url: '/station/inbound'
        },
        {
          id: 'station-inbound-flights',
          title: 'Flight Management',
          type: 'item',
          url: '/station/inbound/flights',
          matchPrefix: true
        },
        {
          id: 'station-inbound-waybills',
          title: 'AWB Management',
          type: 'item',
          url: '/station/inbound/waybills'
        },
        {
          id: 'station-inbound-mobile',
          title: 'PDA Operations',
          type: 'item',
          url: '/station/inbound/mobile'
        }
      ]
    },
    {
      id: 'station-outbound',
      title: 'Outbound Operations',
      type: 'collapse',
      url: '/station/outbound',
      icon: icons.ExportOutlined,
      children: [
        {
          id: 'station-outbound-overview',
          title: 'Overview',
          type: 'item',
          url: '/station/outbound'
        },
        {
          id: 'station-outbound-flights',
          title: 'Flight Management',
          type: 'item',
          url: '/station/outbound/flights'
        },
        {
          id: 'station-outbound-waybills',
          title: 'AWB Management',
          type: 'item',
          url: '/station/outbound/waybills'
        }
      ]
    },
    {
      id: 'station-shipments',
      title: 'AWB and Fulfillment',
      type: 'item',
      url: '/station/shipments',
      matchPrefix: true,
      icon: icons.IdcardOutlined
    },
    {
      id: 'station-documents',
      title: 'Documents and Actions',
      type: 'collapse',
      url: '/station/documents',
      icon: icons.FileTextOutlined,
      children: [
        { id: 'station-documents-overview', title: 'Overview', type: 'item', url: '/station/documents' },
        { id: 'station-documents-noa', title: 'NOA Actions', type: 'item', url: '/station/documents/noa' },
        { id: 'station-documents-pod', title: 'POD Follow-up', type: 'item', url: '/station/documents/pod' }
      ]
    },
    {
      id: 'station-tasks',
      title: 'Task Center',
      type: 'item',
      url: '/station/tasks',
      icon: icons.DashboardOutlined
    },
    {
      id: 'station-copilot',
      title: 'Copilot Workspace',
      type: 'item',
      url: '/station/copilot',
      icon: MessageOutlined
    },
    {
      id: 'station-resources',
      title: 'Teams / Zones / Devices',
      type: 'collapse',
      url: '/station/resources',
      icon: icons.IdcardOutlined,
      children: [
        { id: 'station-resources-overview', title: 'Overview', type: 'item', url: '/station/resources' },
        { id: 'station-resources-teams', title: 'Teams and Staff', type: 'item', url: '/station/resources/teams' },
        { id: 'station-resources-zones', title: 'Zones and Docks', type: 'item', url: '/station/resources/zones' },
        { id: 'station-resources-devices', title: 'PDA Device Binding', type: 'item', url: '/station/resources/devices' },
        { id: 'station-resources-vehicles', title: 'Vehicles and Collection Notes', type: 'item', url: '/station/resources/vehicles' }
      ]
    },
    {
      id: 'station-exceptions',
      title: 'Exception Center',
      type: 'collapse',
      url: '/station/exceptions',
      icon: icons.AlertOutlined,
      children: [
        { id: 'station-exceptions-overview', title: 'Overview', type: 'item', url: '/station/exceptions' },
        { id: 'station-exceptions-detail-demo', title: 'Exception Detail Demo', type: 'item', url: '/station/exceptions/EXP-0408-001' }
      ]
    },
    {
      id: 'station-reports',
      title: 'Station Reports',
      type: 'collapse',
      url: '/station/reports',
      icon: icons.BarChartOutlined,
      children: [
        { id: 'station-reports-overview', title: 'Overview', type: 'item', url: '/station/reports' },
        { id: 'station-reports-shift', title: 'Shift Reports', type: 'item', url: '/station/reports/shift' }
      ]
    }
  ]
};

export default station;
