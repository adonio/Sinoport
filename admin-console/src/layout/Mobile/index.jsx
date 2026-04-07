import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import LeftOutlined from '@ant-design/icons/LeftOutlined';
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';

import sinoportLogo from 'assets/images/sinoport-logo.png';
import { clearMobileSession, readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { getMobileLanguageOptions, localizeMobileText, readMobileLanguage, t, translateRenderedText, writeMobileLanguage } from 'utils/mobile/i18n';

function resolveShell(pathname) {
  let match = pathname.match(/^\/mobile\/inbound\/([^/]+)\/breakdown$/);
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
  if (match) return { titleKey: 'loading', subtitle: match[1], backPath: '/mobile/outbound' };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/pmc\/new$/);
  if (match) return { titleKey: 'new_container', subtitle: match[1], backPath: `/mobile/outbound/${match[1]}/pmc` };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)\/pmc\/([^/]+)$/);
  if (match) return { titleKey: 'container_loading', subtitle: match[2], backPath: `/mobile/outbound/${match[1]}/pmc` };

  match = pathname.match(/^\/mobile\/outbound\/([^/]+)$/);
  if (match) return { titleKey: 'overview', subtitle: match[1], backPath: '/mobile/outbound' };

  if (pathname === '/mobile/select') {
    return { titleKey: 'choose_business', subtitleKey: 'business_pair', backPath: null };
  }

  if (pathname === '/mobile/inbound') {
    return { titleKey: 'inbound_flights', subtitleKey: 'select_flight', backPath: '/mobile/select' };
  }

  if (pathname === '/mobile/outbound') {
    return { titleKey: 'outbound_flights', subtitleKey: 'select_flight', backPath: '/mobile/select' };
  }

  return { titleKey: 'pda_terminal', subtitle: '', backPath: '/mobile/select' };
}

export default function MobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = readMobileSession();
  const language = session?.language || readMobileLanguage();
  const shell = resolveShell(location.pathname);
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
    <Box data-mobile-shell="true" sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: { xs: 0, sm: 2 } }}>
      <Box
        sx={{
          maxWidth: 480,
          minHeight: '100vh',
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
            py: 1.5,
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

        <Box sx={{ flex: 1, px: 2, py: 2.5, pb: 4 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
