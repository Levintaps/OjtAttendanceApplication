// Credits Modal with Movie-Style Auto-Scroll - CSS ANIMATION VERSION
function showAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';

        const creditsContainer = modal.querySelector('.credits-container');
        const creditsContent = modal.querySelector('.credits-content');

        if (creditsContainer && creditsContent) {
            // Reset scroll position
            creditsContainer.scrollTop = 0;

            // Remove any existing animation class
            creditsContent.classList.remove('credits-scrolling');

            // Wait for modal to be fully rendered
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Calculate scroll distance
                    const scrollHeight = creditsContainer.scrollHeight - creditsContainer.clientHeight;

                    if (scrollHeight <= 0) {
                        console.log('No scrollable content');
                        return;
                    }

                    // Calculate duration based on content height (slower = more seconds per pixel)
                    const duration = scrollHeight / 30; // Adjust this: lower number = faster

                    // Set CSS variable for animation duration
                    creditsContent.style.setProperty('--scroll-duration', `${duration}s`);

                    // Start animation after delay
                    setTimeout(() => {
                        if (modal.classList.contains('show')) {
                            creditsContent.classList.add('credits-scrolling');
                        }
                    }, 1000);
                });
            });

            // Pause on hover
            creditsContainer.addEventListener('mouseenter', () => {
                creditsContent.style.animationPlayState = 'paused';
            });

            creditsContainer.addEventListener('mouseleave', () => {
                creditsContent.style.animationPlayState = 'running';
            });

            // Stop on manual scroll
            creditsContainer.addEventListener('wheel', () => {
                creditsContent.classList.remove('credits-scrolling');
            }, { once: true });
        }
    }
}

function closeAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';

        // Reset animation
        const creditsContent = modal.querySelector('.credits-content');
        if (creditsContent) {
            creditsContent.classList.remove('credits-scrolling');
            creditsContent.style.animationPlayState = 'running';
        }

        const creditsContainer = modal.querySelector('.credits-container');
        if (creditsContainer) {
            creditsContainer.scrollTop = 0;
        }
    }
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('aboutModal');
    if (modal && modal.classList.contains('show')) {
        if (e.key === 'Escape') {
            closeAboutModal();
        }
    }
});