// assets
import BorderOutlined from '@ant-design/icons/BorderOutlined';
import BoxPlotOutlined from '@ant-design/icons/BoxPlotOutlined';
import DeploymentUnitOutlined from '@ant-design/icons/DeploymentUnitOutlined';
import GatewayOutlined from '@ant-design/icons/GatewayOutlined';
import MenuUnfoldOutlined from '@ant-design/icons/MenuUnfoldOutlined';
import QuestionOutlined from '@ant-design/icons/QuestionOutlined';
import SmileOutlined from '@ant-design/icons/SmileOutlined';
import StopOutlined from '@ant-design/icons/StopOutlined';

// icons
const icons = {
  BorderOutlined,
  BoxPlotOutlined,
  DeploymentUnitOutlined,
  GatewayOutlined,
  MenuUnfoldOutlined,
  QuestionOutlined,
  StopOutlined,
  SmileOutlined
};

// ==============================|| MENU ITEMS - SUPPORT ||============================== //

const other = {
  id: 'other',
  type: 'group',
  children: [
    {
      id: 'menu-level',
      title: 'menu-level',
      type: 'collapse',
      icon: icons.MenuUnfoldOutlined,
      children: [
        {
          id: 'menu-level-1.1',
          title: 'level 1',
          type: 'item',
          url: '#'
        },
        {
          id: 'menu-level-1.2',
          title: 'level 1',
          type: 'collapse',
          children: [
            {
              id: 'menu-level-2.1',
              title: 'level 2',
              type: 'item',
              url: '#'
            },
            {
              id: 'menu-level-2.2',
              title: 'level 2',
              type: 'collapse',
              children: [
                {
                  id: 'menu-level-3.1',
                  title: 'level 3',
                  type: 'item',
                  url: '#'
                },
                {
                  id: 'menu-level-3.2',
                  title: 'level 3',
                  type: 'item',
                  url: '#'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'menu-level-subtitle',
      title: 'menu-level-subtitle',
      caption: 'menu-level-subtitle-caption',
      type: 'collapse',
      icon: icons.BoxPlotOutlined,
      children: [
        {
          id: 'sub-menu-level-1.1',
          title: 'level 1',
          caption: 'menu-level-subtitle-item',
          type: 'item',
          url: '#'
        },
        {
          id: 'sub-menu-level-1.2',
          title: 'level 1',
          caption: 'menu-level-subtitle-collapse',
          type: 'collapse',
          children: [
            {
              id: 'sub-menu-level-2.1',
              title: 'level 2',
              caption: 'menu-level-subtitle-sub-item',
              type: 'item',
              url: '#'
            }
          ]
        }
      ]
    },
    {
      id: 'disabled-menu',
      title: 'disabled-menu',
      type: 'item',
      url: '#',
      icon: icons.StopOutlined,
      disabled: true
    },
    {
      id: 'oval-chip-menu',
      title: 'oval-chip-menu',
      type: 'item',
      url: '#',
      icon: icons.BorderOutlined
    },
    {
      id: 'documentation',
      title: 'documentation',
      type: 'item',
      url: 'https://codedthemes.gitbook.io/mantis/',
      icon: icons.QuestionOutlined,
      external: true,
      target: true,
      chip: {
        label: 'gitbook',
        color: 'secondary',
        size: 'small'
      }
    },
    {
      id: 'roadmap',
      title: 'roadmap',
      type: 'item',
      url: 'https://codedthemes.gitbook.io/mantis/roadmap',
      icon: icons.DeploymentUnitOutlined,
      external: true,
      target: true
    }
  ]
};

export default other;
