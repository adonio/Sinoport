import PropTypes from 'prop-types';
// material-ui
import { useColorScheme } from '@mui/material/styles';

// third-party
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yDark, a11yLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// project imports
import { ThemeMode } from 'config';

// ==============================|| CODE HIGHLIGHTER ||============================== //

export default function SyntaxHighlight({ children, language = 'javascript', darkStyle = false, ...others }) {
  const { colorScheme } = useColorScheme();

  return (
    <SyntaxHighlighter
      language={language}
      showLineNumbers
      style={colorScheme === ThemeMode.DARK && !darkStyle ? a11yLight : a11yDark}
      {...others}
    >
      {children}
    </SyntaxHighlighter>
  );
}

SyntaxHighlight.propTypes = { children: PropTypes.string, language: PropTypes.string, darkStyle: PropTypes.bool, others: PropTypes.any };
