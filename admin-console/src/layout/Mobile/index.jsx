import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import BarcodeOutlined from '@ant-design/icons/BarcodeOutlined';
import CarOutlined from '@ant-design/icons/CarOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';
import LeftOutlined from '@ant-design/icons/LeftOutlined';
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';

import sinoportLogo from 'assets/images/sinoport-logo.png';
import { clearMobileSession, readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { getMobileLanguageOptions, localizeMobileText, readMobileLanguage, t, translateRenderedText, writeMobileLanguage } from 'utils/mobile/i18n';

function resolveBottomNav(pathname, language) {
  let match = pathname.match(/^\/mobile\/inbound\/([^/]+)(?:\/.*)?$/);
  if (match) {
    const flightNo = match[1];
    const activeKey = pathname.includes('/breakdown')
      ? 'counting'
      : pathname.includes('/pallet')
        ? 'pallet'
        : pathname.includes('/loading')
          ? 'loading'
          : 'overview';

    return {
      variant: 'section',
      activeKey,
      items: [
        { key: 'overview', label: t(language, 'overview'), icon: AppstoreOutlined, path: `/mobile/inbound/${flightNo}` },
        { key: 'counting', label: t(language, 'counting'), icon: BarcodeOutlined, path: `/mobile/inbound/${flightNo}/breakdown` },
        { key: 'pallet', label: t(language, 'pallet'), icon: InboxOutlined, path: `/mobile/inbound/${flightNo}/pallet` },
        { key: 'loading', label: t(language, 'loading'), icon: CarOutlined, path: `/mobile/inbound/${flightNo}/loading` }
      ]
    };
  }

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)(?:\/.*)?$/);
  if (match) {
    const flightNo = match[1];
    const activeKey = pathname.includes('/receipt')
      ? 'receipt'
      : pathname.includes('/pmc')
        ? 'container'
        : pathname.includes('/loading')
          ? 'loading'
          : 'overview';

    return {
      variant: 'section',
      activeKey,
      items: [
        { key: 'overview', label: t(language, 'overview'), icon: AppstoreOutlined, path: `/mobile/outbound/${flightNo}` },
        { key: 'receipt', label: t(language, 'receipt'), icon: InboxOutlined, path: `/mobile/outbound/${flightNo}/receipt` },
        { key: 'container', label: t(language, 'container'), icon: BarcodeOutlined, path: `/mobile/outbound/${flightNo}/pmc` },
        { key: 'loading', label: language === 'en' ? 'Aircraft' : '装机', icon: CarOutlined, path: `/mobile/outbound/${flightNo}/loading` }
      ]
    };
  }

  return null;
}

function MobileBottomNav({ nav, onNavigate }) {
  if (!nav?.items?.length) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        px: 1.5,
        pt: 1,
        pb: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 12,
        pointerEvents: 'none'
      }}
    >
      <Paper
        elevation={6}
        sx={{
          borderRadius: 4,
          px: 1,
          py: 0.75,
          overflow: 'hidden',
          pointerEvents: 'auto'
        }}
      >
        <Stack
          direction="row"
          sx={{
            gap: 1,
            overflowX: 'visible',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          {nav.items.map((item) => {
            const active = nav.activeKey === item.key;
            const Icon = item.icon;

            return (
              <Button
                key={item.key}
                onClick={() => onNavigate(item.path)}
                variant={active ? 'contained' : 'text'}
                color={active ? 'primary' : 'inherit'}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  px: 0.75,
                  py: 1.25,
                  borderRadius: 2.5,
                  color: active ? 'common.white' : 'text.primary'
                }}
              >
                <Stack sx={{ alignItems: 'center', gap: 0.65, width: '100%' }}>
                  <Icon />
                  <Typography variant="caption" sx={{ lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                    {item.label}
                  </Typography>
                </Stack>
              </Button>
            );
          })}
        </Stack>
      </Paper>
    </Box>
  );
}

function resolveShell(pathname) {
  let match = pathname.match(/^\/mobile\/pre-warehouse\/([^/]+)$/);
  if (match) return { titleKey: 'pre_warehouse_task', subtitle: match[1], backPath: '/mobile/pre-warehouse' };

  match = pathname.match(/^\/mobile\/headhaul\/([^/]+)$/);
  if (match) return { titleKey: 'headhaul_task', subtitle: match[1], backPath: '/mobile/headhaul' };

  match = pathname.match(/^\/mobile\/runtime\/([^/]+)$/);
  if (match) return { titleKey: 'runtime_task', subtitle: match[1], backPath: '/mobile/runtime' };

  match = pathname.match(/^\/mobile\/inbound\/([^/]+)\/breakdown$/);
  if (match) return { titleKey: 'counting', subtitle: match[1], backPath: '/mobile/inbound' };

  match = pathname.match(/^\/mobile\/inbound\/([^/]+)\/pallet\/new$/);
  if (match) return { titleKey: 'new_pallet', subtitle: match[1], backPath: `/mobile/inbound/${match[1]}/pallet` };

  match = pathname.match(/^\/mobile\/inbound\/([^/]+)\/loading\/new$/);
  if (match) return { titleKey: 'new_loading_plan', subtitle: match[1], backPath: `/mobile/inbound/${match[1]}/loading` };

  match = pathname.match(/^\/mobile\/inbound\/([^/]+)\/loading\/plan\/([^/]+)$/);
  if (match) return { titleKey: 'execute_loading', subtitle: match[1], backPath: `/mobile/inbound/${match[1]}/loading` };

  match = pathname.match(/^\/mobile\/inbound\/([^/]+)\/pallet$/);
  if (match) return { titleKey: 'pallet', subtitle: match[1], backPath: '/mobile/inbound' };

  match = pathname.match(/^\/mobile\/inbound\/([^/]+)\/loading$/);
  if (match) return { titleKey: 'loading', subtitle: match[1], backPath: '/mobile/inbound' };

  match = pathname.match(/^\/mobile\/inbound\/([^/]+)$/);
  if (match) return { titleKey: 'overview', subtitle: match[1], backPath: '/mobile/inbound' };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/pmc$/);
  if (match) return { titleKey: 'container', subtitle: match[1], backPath: '/mobile/outbound' };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/receipt$/);
  if (match) return { titleKey: 'receipt', subtitle: match[1], backPath: '/mobile/outbound' };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/receipt\/counting$/);
  if (match) return { titleKey: 'counting', subtitle: match[1], backPath: `/mobile/outbound/${match[1]}/receipt` };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/receipt\/counting\/([^/]+)$/);
  if (match) return { titleKey: 'counting', subtitle: match[2], backPath: `/mobile/outbound/${match[1]}/receipt` };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/loading$/);
  if (match) return { titleKey: 'aircraft_loading', subtitle: match[1], backPath: '/mobile/outbound' };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/pmc\/new$/);
  if (match) return { titleKey: 'new_container', subtitle: match[1], backPath: `/mobile/outbound/${match[1]}/pmc` };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/pmc\/([^/]+)$/);
  if (match) return { titleKey: 'container_loading', subtitle: match[2], backPath: `/mobile/outbound/${match[1]}/pmc` };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)$/);
  if (match) return { titleKey: 'overview', subtitle: match[1], backPath: '/mobile/outbound' };

  match = pathname.match(/^\/mobile\/export-ramp\/([^/]+)$/);
  if (match) return { titleKey: 'export_ramp_task', subtitle: match[1], backPath: '/mobile/export-ramp' };

  match = pathname.match(/^\/mobile\/destination-ramp\/([^/]+)$/);
  if (match) return { titleKey: 'destination_ramp_task', subtitle: match[1], backPath: '/mobile/destination-ramp' };

  match = pathname.match(/^\/mobile\/tailhaul\/([^/]+)$/);
  if (match) return { titleKey: 'tailhaul_task', subtitle: match[1], backPath: '/mobile/tailhaul' };

  match = pathname.match(/^\/mobile\/delivery\/([^/]+)$/);
  if (match) return { titleKey: 'delivery_task', subtitle: match[1], backPath: '/mobile/delivery' };

  if (pathname === '/mobile/select') {
    return { titleKey: 'choose_node', subtitleKey: 'node_pair', backPath: null };
  }

  if (pathname === '/mobile/pre-warehouse') {
    return { titleKey: 'pre_warehouse_batches', subtitleKey: 'select_task', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/headhaul') {
    return { titleKey: 'headhaul_trips', subtitleKey: 'select_task', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/runtime') {
    return { titleKey: 'runtime_flights', subtitleKey: 'select_task', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/inbound') {
    return { titleKey: 'inbound_flights', subtitleKey: 'select_flight', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/outbound') {
    return { titleKey: 'outbound_flights', subtitleKey: 'select_flight', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/export-ramp') {
    return { titleKey: 'export_ramp_flights', subtitleKey: 'select_task', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/destination-ramp') {
    return { titleKey: 'destination_ramp_flights', subtitleKey: 'select_task', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/tailhaul') {
    return { titleKey: 'tailhaul_trips', subtitleKey: 'select_task', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/delivery') {
    return { titleKey: 'delivery_runs', subtitleKey: 'select_task', backPath: '/mobile/select' };
  }

  return { titleKey: 'pda_terminal', subtitle: '', backPath: '/mobile/select' };
}

export default function MobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = readMobileSession();
  const language = session?.language || readMobileLanguage();
  const shell = resolveShell(location.pathname);
  const bottomNav = resolveBottomNav(location.pathname, language);
  const languageOptions = getMobileLanguageOptions(language);

  useEffect(() => {
    if (language !== 'en') return undefined;

    const root = document.querySelector('[data-mobile-shell="true"]');
    if (!root) return undefined;

    const applyTranslations = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const original = node.nodeValue;
        const translated = translateRenderedText(language, original);
        if (translated !== original) {
          node.nodeValue = translated;
        }
        node = walker.nextNode();
      }

      root.querySelectorAll('input[placeholder]').forEach((element) => {
        const original = element.getAttribute('placeholder') || '';
        const translated = translateRenderedText(language, original);
        if (translated !== original) {
          element.setAttribute('placeholder', translated);
        }
      });
    };

    applyTranslations();
    const observer = new MutationObserver(() => applyTranslations());
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [language, location.pathname]);

  return (
    <Box data-mobile-shell="true" sx={{ height: '100dvh', overflow: 'hidden', bgcolor: 'grey.100' }}>
      <Box
        sx={{
          maxWidth: 480,
          height: '100%',
          mx: 'auto',
          bgcolor: 'background.default',
          boxShadow: { sm: 3 },
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            px: 2,
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(14px)'
          }}
        >
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <Box component="img" src={sinoportLogo} alt="Sinoport" sx={{ height: 24, width: 'auto' }} />
                <Typography variant="subtitle2" noWrap>
                  {t(language, 'pda_terminal')}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <TextField
                  name="mobile-language"
                  select
                  size="small"
                  value={language}
                  onChange={(event) => {
                    const nextLanguage = event.target.value;
                    writeMobileLanguage(nextLanguage);
                    if (session) {
                      writeMobileSession({ ...session, language: nextLanguage });
                    }
                    navigate(0);
                  }}
                  sx={{ minWidth: 104 }}
                >
                  {languageOptions.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<LogoutOutlined />}
                  onClick={() => {
                    clearMobileSession();
                    navigate('/mobile/login', { replace: true });
                  }}
                >
                  {t(language, 'logout')}
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
              {shell.backPath ? (
                <IconButton color="inherit" onClick={() => navigate(shell.backPath)}>
                  <LeftOutlined />
                </IconButton>
              ) : (
                <Box sx={{ width: 40, height: 40 }} />
              )}
              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="h5" noWrap>
                  {t(language, shell.titleKey)}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {[
                    shell.subtitleKey ? t(language, shell.subtitleKey) : shell.subtitle,
                    localizeMobileText(language, session?.station || ''),
                    session?.operator
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              overflowY: 'auto',
              px: 2,
              py: 2,
              pb: bottomNav ? 14 : 4,
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <Outlet />
          </Box>
        </Box>

        <MobileBottomNav nav={bottomNav} onNavigate={navigate} />
      </Box>
    </Box>
  );
}
