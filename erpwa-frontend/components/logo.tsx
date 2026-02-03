"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    collapsed?: boolean;
    isSidebar?: boolean;
}

export function Logo({ className, collapsed, isSidebar = false }: LogoProps) {
    // Shared styles
    const styles = (
        <defs>
            <style>
                {`
              @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&display=swap');
              
              .navy { 
                fill: #23284e; 
                transition: fill 0.2s ease;
              }
              
              /* Dark mode: G becomes white/grey */
              html.dark .navy {
                fill: #eae2e2ff;
              }
              
              .logo-stroke {
                stroke: white;
                transition: stroke 0.2s ease;
              }
              
              /* Dark mode: Borders become black */
              html.dark .logo-stroke {
                stroke: #000000;
              }

              .orange { fill: #ee6c1e; }
              
              .text-ps {
                font-family: "Montserrat", sans-serif;
                font-weight: 600;
                font-size: 130px;
                letter-spacing: -3px;
              }
              
              .text-erp {
                font-family: "Montserrat", sans-serif;
                font-weight: 400;
                font-size: 100px;
                letter-spacing: -2px;
                fill: #000000; /* Default black for light mode */
                transition: fill 0.2s ease;
              }
              
              .text-erp-sidebar {
                font-size: 135px; /* Larger to fill space */
                font-weight: 500;
              }
              
              /* Dark mode override */
              html.dark .text-erp {
                fill: #e0d1d1ff;
              }

              .text-ps-dark {
                font-family: "Montserrat", sans-serif;
                font-weight: 600;
                font-size: 130px;
                letter-spacing: -3px;
                fill: #ee6c1e; 
              }
            `}
            </style>
        </defs>
    );

    const LogoIcon = () => (
        <g transform="translate(15, 20) scale(1.1)">
            <rect x="80" y="0" width="30" height="30" className="orange" />
            <path
                className="navy"
                d="M 110,50 
               A 55,55 0 1,1 0,50 
               A 55,55 0 0,1 110,50 
               Z M 88,50 
               A 33,33 0 1,0 22,50 
               A 33,33 0 0,0 88,50 Z"
                fillRule="evenodd"
            />
            {/* Outer circle stroke */}
            <circle cx="55" cy="50" r="55" fill="none" className="logo-stroke" strokeWidth="3" />
            {/* Inner circle stroke */}
            <circle cx="55" cy="50" r="33" fill="none" className="logo-stroke" strokeWidth="3" />

            <path
                className="navy"
                d="M 0,115 
               A 55,55 0 0,0 110,115 
               L 110,105 
               L 88,105 
               L 88,115 
               A 33,33 0 0,1 22,115 
               L 22,105 
               L 0,105 Z"
            />

            {/* Inner U stroke */}
            <path
                d="M 88,105 L 88,115 A 33,33 0 0,1 22,115 L 22,105"
                fill="none"
                className="logo-stroke"
                strokeWidth="3"
            />
        </g>
    );

    if (collapsed) {
        // Collapsed version - just the icon centered
        return (
            <div className={cn("flex items-center justify-center select-none", className)}>
                <svg
                    viewBox="10 15 130 170" // Adjusted for G-icon bounds (approx X:15-136, Y:20-183)
                    xmlns="http://www.w3.org/2000/svg"
                    shapeRendering="geometricPrecision"
                    className="w-full h-full"
                >
                    {styles}
                    <LogoIcon />
                </svg>
            </div>
        );
    }

    // Full logo - with extra width to prevent cutting
    return (
        <div className={cn("flex items-center select-none", isSidebar && !collapsed ? "justify-start" : "justify-center", className)}>
            <svg
                viewBox="0 0 600 230"
                xmlns="http://www.w3.org/2000/svg"
                shapeRendering="geometricPrecision"
                className="w-full h-full"
                preserveAspectRatio={isSidebar ? "xMinYMid meet" : "xMidYMid meet"}
            >
                {styles}
                <LogoIcon />

                <g transform="translate(130, 120)">
                    {isSidebar ? (
                        /* Sidebar Layout: Side-by-side */
                        <>
                            <text x="5" y="0" className="orange text-ps">PS</text>
                            <text x="190" y="0" className="text-erp text-erp-sidebar">erp</text>
                        </>
                    ) : (
                        /* Default / Login Layout: Stacked */
                        <>
                            <text x="5" y="0" className="orange text-ps">PS</text>
                            <text x="5" y="90" className="text-erp">erp</text>
                        </>
                    )}
                </g>
            </svg>
        </div>
    );
}
