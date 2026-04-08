import AlertOutlined from '@ant-design/icons/AlertOutlined';
import ApartmentOutlined from '@ant-design/icons/ApartmentOutlined';
import BarChartOutlined from '@ant-design/icons/BarChartOutlined';
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
      { id: 'platform-operations', title: '运行态势中心', icon: <DashboardOutlined />, path: '/platform/operations' },
      { id: 'platform-stations', title: '货站与资源管理', icon: <ApartmentOutlined />, path: '/platform/stations' },
      { id: 'platform-stations-capabilities', title: '货站能力矩阵', icon: <ApartmentOutlined />, path: '/platform/stations/capabilities' },
      { id: 'platform-stations-teams', title: '站点班组映射', icon: <ApartmentOutlined />, path: '/platform/stations/teams' },
      { id: 'platform-stations-zones', title: '站点区位映射', icon: <ApartmentOutlined />, path: '/platform/stations/zones' },
      { id: 'platform-stations-devices', title: '站点设备映射', icon: <ApartmentOutlined />, path: '/platform/stations/devices' },
      { id: 'platform-network', title: '航线网络与链路配置', icon: <EnvironmentOutlined />, path: '/platform/network' },
      { id: 'platform-network-lanes', title: '链路模板', icon: <EnvironmentOutlined />, path: '/platform/network/lanes' },
      { id: 'platform-network-scenarios', title: '标准场景模板', icon: <EnvironmentOutlined />, path: '/platform/network/scenarios' },
      { id: 'platform-rules', title: '规则与指令引擎', icon: <DatabaseOutlined />, path: '/platform/rules' },
      { id: 'platform-master-data', title: '主数据与接口治理', icon: <DatabaseOutlined />, path: '/platform/master-data' },
      { id: 'platform-audit', title: '审计与可信留痕', icon: <FileDoneOutlined />, path: '/platform/audit' },
      { id: 'platform-reports', title: '平台级报表', icon: <BarChartOutlined />, path: '/platform/reports' },
      { id: 'platform-sync', title: '接口同步看板', icon: <DatabaseOutlined />, path: '/platform/master-data/sync' },
      { id: 'platform-jobs', title: '导入任务日志', icon: <DatabaseOutlined />, path: '/platform/master-data/jobs' },
      { id: 'platform-relationships', title: '对象关系总览', icon: <DatabaseOutlined />, path: '/platform/master-data/relationships' },
      { id: 'platform-audit-events', title: '审计事件明细', icon: <FileDoneOutlined />, path: '/platform/audit/events' },
      { id: 'platform-audit-trust', title: '可信留痕占位', icon: <FileDoneOutlined />, path: '/platform/audit/trust' },
      { id: 'platform-reports-stations', title: '站点对比报表', icon: <BarChartOutlined />, path: '/platform/reports/stations' }
    ]
  },
  {
    id: 'station',
    title: '货站后台',
    childs: [
      { id: 'station-dashboard', title: '货站看板', icon: <IdcardOutlined />, path: '/station/dashboard' },
      { id: 'station-inbound-overview', title: '进港看板', icon: <ImportOutlined />, path: '/station/inbound' },
      { id: 'station-inbound-flights', title: '进港航班管理', icon: <ImportOutlined />, path: '/station/inbound/flights' },
      { id: 'station-inbound-mobile', title: 'PDA 作业终端', icon: <ImportOutlined />, path: '/station/inbound/mobile' },
      { id: 'station-outbound-overview', title: '出港看板', icon: <ExportOutlined />, path: '/station/outbound' },
      { id: 'station-outbound-flights', title: '出港航班管理', icon: <ExportOutlined />, path: '/station/outbound/flights' },
      { id: 'station-shipments', title: '提单与履约链路', icon: <FileTextOutlined />, path: '/station/shipments' },
      { id: 'station-documents', title: '单证与指令中心', icon: <FileTextOutlined />, path: '/station/documents' },
      { id: 'station-tasks', title: '作业指令中心', icon: <DashboardOutlined />, path: '/station/tasks' },
      { id: 'station-resources', title: '班组 / 区位 / 设备管理', icon: <ApartmentOutlined />, path: '/station/resources' },
      { id: 'station-resources-teams', title: '班组与人员', icon: <ApartmentOutlined />, path: '/station/resources/teams' },
      { id: 'station-resources-zones', title: '区位与 Dock', icon: <ApartmentOutlined />, path: '/station/resources/zones' },
      { id: 'station-resources-devices', title: 'PDA 设备绑定', icon: <ApartmentOutlined />, path: '/station/resources/devices' },
      { id: 'station-resources-vehicles', title: '车辆与 Collection Note', icon: <ApartmentOutlined />, path: '/station/resources/vehicles' },
      { id: 'station-exceptions', title: '异常中心', icon: <AlertOutlined />, path: '/station/exceptions' },
      { id: 'station-exception-detail', title: '异常详情示例', icon: <AlertOutlined />, path: '/station/exceptions/EXP-0408-001' },
      { id: 'station-documents-noa', title: 'NOA 通知动作', icon: <FileTextOutlined />, path: '/station/documents/noa' },
      { id: 'station-documents-pod', title: 'POD 补签动作', icon: <FileTextOutlined />, path: '/station/documents/pod' },
      { id: 'station-reports', title: '货站层报表', icon: <BarChartOutlined />, path: '/station/reports' },
      { id: 'station-reports-shift', title: '班次报表', icon: <BarChartOutlined />, path: '/station/reports/shift' }
    ]
  },
  {
    id: 'prd',
    title: '业务依据',
    childs: [{ id: 'prd-rules', title: '平台与货站 PRD', icon: <QuestionCircleOutlined />, path: '/platform/rules' }]
  }
];
