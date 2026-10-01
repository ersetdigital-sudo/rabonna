import * as React from "react";

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  reverse?: boolean;
  pauseOnHover?: boolean;
  vertical?: boolean;
  speed?: number;
}

const Marquee = React.forwardRef<HTMLDivElement, MarqueeProps>(
  ({ className = "", reverse = false, pauseOnHover = false, vertical = false, speed = 40, children, ...props }, ref) => {
    const classes = `group relative flex gap-4 overflow-hidden ${vertical ? "flex-col" : "flex-row"} ${className}`;

    return (
      <div ref={ref} className={classes} {...props}>
        {vertical ? (
          <>
            <div
              className="flex shrink-0 flex-col gap-4"
              style={{
                animation: `marquee-vertical ${speed}s linear infinite`,
                animationDirection: reverse ? "reverse" : "normal",
              }}
            >
              {children}
            </div>
            <div
              className="flex shrink-0 flex-col gap-4"
              aria-hidden
              style={{
                animation: `marquee-vertical ${speed}s linear infinite`,
                animationDirection: reverse ? "reverse" : "normal",
              }}
            >
              {children}
            </div>
          </>
        ) : (
          <>
            <div
              className="flex shrink-0 gap-4"
              style={{
                animation: `marquee-horizontal ${speed}s linear infinite`,
                animationDirection: reverse ? "reverse" : "normal",
              }}
            >
              {children}
            </div>
            <div
              className="flex shrink-0 gap-4"
              aria-hidden
              style={{
                animation: `marquee-horizontal ${speed}s linear infinite`,
                animationDirection: reverse ? "reverse" : "normal",
              }}
            >
              {children}
            </div>
          </>
        )}
      </div>
    );
  }
);
Marquee.displayName = "Marquee";

export { Marquee, type MarqueeProps };
