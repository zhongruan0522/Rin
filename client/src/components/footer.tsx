import { useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { ClientConfigContext } from '../state/config';
import { buildLoginPath, HIDDEN_LOGIN_REDIRECT } from "../utils/auth-redirect";

type ThemeMode = 'light' | 'dark' | 'system';
function Footer() {
    const [, setLocation] = useLocation()
    const [modeState, setModeState] = useState<ThemeMode>('system');
    const config = useContext(ClientConfigContext);
    const footerHtml = config.get<string>('footer');
    const footerHtmlRef = useRef<HTMLDivElement | null>(null);
    const mountedScriptNodesRef = useRef<HTMLScriptElement[]>([]);
    const loginEnabled = config.getBoolean('login.enabled');
    const [doubleClickTimes, setDoubleClickTimes] = useState(0);
    useEffect(() => {
        const mode = localStorage.getItem('theme') as ThemeMode || 'system';
        setModeState(mode);
        setMode(mode);
    }, [])

    useEffect(() => {
        const container = footerHtmlRef.current;
        if (!container) {
            return;
        }

        mountedScriptNodesRef.current.forEach((script) => script.remove());
        mountedScriptNodesRef.current = [];
        container.replaceChildren();

        if (!footerHtml) {
            return;
        }

        const template = document.createElement('template');
        template.innerHTML = footerHtml;

        const scripts = Array.from(template.content.querySelectorAll('script'));
        scripts.forEach((script) => script.remove());

        container.appendChild(template.content.cloneNode(true));

        scripts.forEach((script) => {
            const nextScript = document.createElement('script');

            Array.from(script.attributes).forEach((attribute) => {
                nextScript.setAttribute(attribute.name, attribute.value);
            });

            nextScript.textContent = script.textContent;
            container.appendChild(nextScript);
            mountedScriptNodesRef.current.push(nextScript);
        });

        return () => {
            mountedScriptNodesRef.current.forEach((script) => script.remove());
            mountedScriptNodesRef.current = [];
        };
    }, [footerHtml])

    const setMode = (mode: ThemeMode) => {
        setModeState(mode);
        localStorage.setItem('theme', mode);


        if (mode !== 'system' || (!('theme' in localStorage) && window.matchMedia(`(prefers-color-scheme: ${mode})`).matches)) {
            document.documentElement.setAttribute('data-color-mode', mode);
        } else {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            if (mediaQuery.matches) {
                document.documentElement.setAttribute('data-color-mode', 'dark');
            } else {
                document.documentElement.setAttribute('data-color-mode', 'light');
            }
        }
        window.dispatchEvent(new Event("colorSchemeChange"));
    };

    return (
        <footer>
            <div className="flex flex-col mb-8 space-y-2 justify-center items-center t-primary ani-show">
                <div ref={footerHtmlRef} />
                <p className='text-sm text-neutral-500 font-normal link-line'>
                    <span onDoubleClick={() => {
                        if(doubleClickTimes >= 2){ // actually need 3 times doubleClick
                            setDoubleClickTimes(0)
                            if(!loginEnabled) {
                                setLocation(buildLoginPath(HIDDEN_LOGIN_REDIRECT))
                            }
                        } else {
                            setDoubleClickTimes(doubleClickTimes + 1)
                        }
                    }}>
                        © {new Date().getFullYear()} Powered by <a className='hover:underline' href="https://github.com/openRin/Rin" target="_blank">Rin</a>
                    </span>
                </p>
                <div className="w-fit-content inline-flex rounded-full border border-zinc-200 p-[3px] dark:border-zinc-700">
                    <ThemeButton mode='light' current={modeState} label="Toggle light mode" icon="ri-sun-line" onClick={setMode} />
                    <ThemeButton mode='system' current={modeState} label="Toggle system mode" icon="ri-computer-line" onClick={setMode} />
                    <ThemeButton mode='dark' current={modeState} label="Toggle dark mode" icon="ri-moon-line" onClick={setMode} />
                </div>
            </div>
        </footer>
    );
}

function ThemeButton({ current, mode, label, icon, onClick }: { current: ThemeMode, label: string, mode: ThemeMode, icon: string, onClick: (mode: ThemeMode) => void }) {
    return (<button aria-label={label} type="button" onClick={() => onClick(mode)}
        className={`rounded-inherit inline-flex h-[32px] w-[32px] items-center justify-center border-0 t-primary ${current === mode ? "bg-w rounded-full shadow-xl shadow-light" : ""}`}>
        <i className={`${icon}`} />
    </button>)
}

export default Footer;
