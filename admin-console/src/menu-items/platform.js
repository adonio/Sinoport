import ApartmentOutlined from '@ant-design/icons/ApartmentOutlined';
import AuditOutlined from '@ant-design/icons/AuditOutlined';
import DashboardOutlined from '@ant-design/icons/DashboardOutlined';
import EnvironmentOutlined from '@ant-design/icons/EnvironmentOutlined';
import ProfileOutlined from '@ant-design/icons/ProfileOutlined';

const icons = {
  ApartmentOutlined,
  AuditOutlined,
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
      id: 'platform-stations',
      title: '货站管理',
      type: 'item',
      url: '/platform/stations',
      icon: icons.DashboardOutlined
    },
    {
      id: 'platform-network',
      title: '航线网络',
      type: 'item',
      url: '/platform/network',
      icon: icons.ApartmentOutlined
    },
    {
      id: 'platform-rules',
      title: '规则中心',
      type: 'item',
      url: '/platform/rules',
      icon: icons.ProfileOutlined
    },
    {
      id: 'platform-audit',
      title: '审计中心',
      type: 'item',
      url: '/platform/audit',
      icon: icons.AuditOutlined
    }
  ]
};

export default platform;
