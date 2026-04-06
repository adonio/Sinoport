import AlertOutlined from '@ant-design/icons/AlertOutlined';
import ApartmentOutlined from '@ant-design/icons/ApartmentOutlined';
import DashboardOutlined from '@ant-design/icons/DashboardOutlined';
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined';
import EnvironmentOutlined from '@ant-design/icons/EnvironmentOutlined';
import ExportOutlined from '@ant-design/icons/ExportOutlined';
import FileDoneOutlined from '@ant-design/icons/FileDoneOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import IdcardOutlined from '@ant-design/icons/IdcardOutlined';
import ImportOutlined from '@ant-design/icons/ImportOutlined';
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined';

export const searchData = [
  {
    id: 'platform',
    title: '平台管理后台',
    childs: [
      { id: 'platform-overview', title: '平台总览', icon: <DashboardOutlined />, path: '/dashboard/platform-overview' },
      { id: 'platform-stations', title: '货站管理', icon: <ApartmentOutlined />, path: '/platform/stations' },
      { id: 'platform-network', title: '航线网络', icon: <EnvironmentOutlined />, path: '/platform/network' },
      { id: 'platform-rules', title: '规则中心', icon: <DatabaseOutlined />, path: '/platform/rules' },
      { id: 'platform-audit', title: '审计中心', icon: <FileDoneOutlined />, path: '/platform/audit' }
    ]
  },
  {
    id: 'station',
    title: '货站后台',
    childs: [
      { id: 'station-dashboard', title: '货站看板', icon: <IdcardOutlined />, path: '/station/dashboard' },
      { id: 'station-inbound-overview', title: '进港看板', icon: <ImportOutlined />, path: '/station/inbound' },
      { id: 'station-inbound-flights', title: '进港航班管理', icon: <ImportOutlined />, path: '/station/inbound/flights' },
      { id: 'station-inbound-waybills', title: '进港提单管理', icon: <FileTextOutlined />, path: '/station/inbound/waybills' },
      { id: 'station-outbound-overview', title: '出港看板', icon: <ExportOutlined />, path: '/station/outbound' },
      { id: 'station-outbound-flights', title: '出港航班管理', icon: <ExportOutlined />, path: '/station/outbound/flights' },
      { id: 'station-outbound-waybills', title: '出港提单管理', icon: <FileTextOutlined />, path: '/station/outbound/waybills' },
      { id: 'station-files', title: '文件中心', icon: <FileTextOutlined />, path: '/station/files' },
      { id: 'station-exceptions', title: '异常中心', icon: <AlertOutlined />, path: '/station/exceptions' }
    ]
  },
  {
    id: 'prd',
    title: '业务依据',
    childs: [{ id: 'prd-rules', title: '平台与货站 PRD', icon: <QuestionCircleOutlined />, path: '/platform/rules' }]
  }
];
