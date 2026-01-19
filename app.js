/**
 * Fact-Checking System Frontend
 * Handles chat interface, streaming messages, and state management
 */

class FactCheckingManager {
    constructor() {
        this.questionInput = document.getElementById('question-input');
        this.sendBtn = document.getElementById('send-btn');
        this.chatForm = document.getElementById('chat-form');
        this.chatMessages = document.getElementById('chat-messages');

        // State management
        this.isWaitingForResponse = false;
        this.currentStreamingMessage = null;
        this.sessionId = null;
        this.timer = null;
        this.timerStartTime = null;
        this.isStreaming = false;
        this.loadingIndicator = null;
        
        // Message queue for sequential rendering
        this.messageQueue = [];
        this.isRendering = false;
        this.userScrolled = false;
        this.autoScrollEnabled = true;

        this.initializeEventListeners();
        this.adjustTextareaHeight();
        this.startMessageReceiver();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        this.chatForm.addEventListener('submit', (e) => this.handleQuestionSubmit(e));
        this.questionInput.addEventListener('input', () => this.adjustTextareaHeight());
        
        this.questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.isWaitingForResponse && this.questionInput.value.trim()) {
                    this.handleQuestionSubmit(e);
                }
            }
        });

        // Track user scroll to prevent auto-scroll when user manually scrolls
        this.chatMessages.addEventListener('scroll', () => {
            const isAtBottom = this.chatMessages.scrollHeight - this.chatMessages.scrollTop <= this.chatMessages.clientHeight + 50;
            this.userScrolled = !isAtBottom;
            this.autoScrollEnabled = isAtBottom;
        });
    }

    /**
     * Handle question submission
     */
    async handleQuestionSubmit(event) {
        event.preventDefault();

        const question = this.questionInput.value.trim();
        
        if (!question || this.isWaitingForResponse) {
            return;
        }

        this.addMessage('user', question);
        this.questionInput.value = '';
        this.adjustTextareaHeight();
        this.updateSendButtonState();

        this.sessionId = this.generateSessionId();
        this.setWaitingState(true);
        this.startTimer();

        this.messageQueue = [];
        this.isRendering = false;
        this.userScrolled = false;
        this.autoScrollEnabled = true;
        this.clearLocalStorageQueue();

        console.log('Session ID:', this.sessionId);
        console.log('Waiting for messages from backend...');
        console.log('Backend can send messages to: POST /.netlify/functions/receive-message');
        
        // ============================================
        // SEND REQUEST TO BACKEND FACT-CHECKING
        // ============================================
        // TODO: Replace BACKEND_FACT_CHECK_URL with actual backend URL
        const BACKEND_FACT_CHECK_URL = 'https://arlo-sloughy-vagally.ngrok-free.dev/api/v1/check-stream'; // <-- FILL BACKEND URL HERE
        
        try {
            const response = await fetch(BACKEND_FACT_CHECK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: question,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const result = await response.json();
            
            if (result.success) {
                console.log('Fact-check request sent successfully to backend');
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('Error sending fact-check request:', error);
            this.removeLoadingIndicator();
            this.addDivider();
            this.addMessage('bot', 'Xin lỗi, đã có lỗi xảy ra khi gửi yêu cầu đến backend. Vui lòng thử lại.');
            this.setWaitingState(false);
            this.stopTimer();
        }
    }

    /**
     * Start timer
     */
    startTimer() {
        this.timerStartTime = Date.now();
        console.log('Timer started');
    }

    /**
     * Stop timer
     */
    stopTimer() {
        if (this.timerStartTime) {
            const elapsed = ((Date.now() - this.timerStartTime) / 1000).toFixed(2);
            console.log(`Timer stopped. Elapsed time: ${elapsed} seconds`);
            return parseFloat(elapsed);
        }
        return 0;
    }

    /**
     * Start message receiver - listens for messages from backend
     */
    startMessageReceiver() {
        setInterval(() => {
            if (this.isWaitingForResponse && this.sessionId && !this.isRendering && !this.isStreaming) {
                this.checkForMessages();
                this.updateLoadingIndicator();
            }
        }, 1000);
    }

    /**
     * Check for new messages from backend
     */
    async checkForMessages() {
        if (!this.isWaitingForResponse || !this.sessionId || this.isRendering || this.isStreaming) {
            return;
        }

        try {
            const response = await fetch(`/.netlify/functions/get-message?sessionId=${this.sessionId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.hasMessage) {
                    this.receiveMessageFromBackend(data.message, data.isComplete);
                }
            }
        } catch (error) {
            console.error('Error checking for messages:', error);
        }
    }

    /**
     * Receive message from backend
     * Message format: {type, header, content}
     * Adds message to queue instead of rendering immediately
     */
    receiveMessageFromBackend(messageObj, isComplete = false) {
        if (!this.isWaitingForResponse) {
            console.log('Ignoring message - not waiting for response');
            return;
        }

        if (!messageObj || !messageObj.type || !messageObj.header || !messageObj.content) {
            console.error('Invalid message format. Expected: {type, header, content}', messageObj);
            return;
        }

        const { type, header, content } = messageObj;

        this.messageQueue.push({
            type,
            header,
            content,
            isComplete
        });

        this.saveQueueToLocalStorage();

        if (!this.isRendering) {
            this.processMessageQueue();
        }
    }

    /**
     * Process message queue - render messages sequentially
     */
    async processMessageQueue() {
        if (this.isRendering || this.messageQueue.length === 0) {
            return;
        }

        if (!this.isWaitingForResponse) {
            this.messageQueue = [];
            this.clearLocalStorageQueue();
            return;
        }
        
        // Load from localStorage if queue is empty (recover after page reload)
        if (this.messageQueue.length === 0 && this.sessionId) {
            this.loadQueueFromLocalStorage();
        }

        const message = this.messageQueue.shift();
        this.isRendering = true;

        if (this.currentStreamingMessage) {
            this.removeLoadingIndicatorFromContent(this.currentStreamingMessage);
            this.currentStreamingMessage = null;
        }

        if (message.type === 'END') {
            const elapsedTime = this.stopTimer();
            
            this.renderMessageWithHeaderAndContent(message.header, message.content, () => {
                this.showCompletionMessageWithStats(elapsedTime);
                this.setWaitingState(false);
                this.currentStreamingMessage = null;
                this.isRendering = false;
                this.messageQueue = [];
                this.clearLocalStorageQueue();
                this.sessionId = null;
            });
        } else {
            this.renderMessageWithHeaderAndContent(message.header, message.content, () => {
                this.removeMessageFromLocalStorage();
                this.isRendering = false;
                this.processMessageQueue();
            });
        }
    }

    /**
     * Render message with header (bold, large) and content (normal) in same bubble
     * @param {string} header - Header text
     * @param {string} content - Content text
     * @param {Function} onComplete - Callback when streaming completes (optional)
     */
    renderMessageWithHeaderAndContent(header, content, onComplete = null) {
        const newMessageBubble = this.createStreamingMessagePlaceholder();
        const contentDiv = newMessageBubble;
        
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-item';

        const headerElement = document.createElement('p');
        headerElement.className = 'message-header';
        headerElement.style.fontWeight = '700';
        headerElement.style.fontSize = '1.2rem';
        headerElement.style.marginBottom = '8px';
        headerElement.style.color = '#2c3e50';
        headerElement.textContent = '';

        const contentElement = document.createElement('p');
        contentElement.className = 'message-content-text';
        contentElement.style.whiteSpace = 'pre-line';
        contentElement.style.lineHeight = '1.6';
        contentElement.textContent = '';

        messageContainer.appendChild(headerElement);
        messageContainer.appendChild(contentElement);
        contentDiv.appendChild(messageContainer);
        
        this.isStreaming = true;
        this.updateLoadingIndicator();
        
        this.streamText(headerElement, header, () => {
            this.streamText(contentElement, content, () => {
                this.isStreaming = false;
                this.updateLoadingIndicator();
                if (onComplete) {
                    onComplete();
                }
            });
        });
    }

    /**
     * Show completion message with time and cost statistics (streaming)
     */
    showCompletionMessageWithStats(elapsedTime) {
        this.addDivider();
        const completionDiv = document.createElement('div');
        completionDiv.className = 'message bot-message';
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar bot-avatar';
        avatar.textContent = '🤖';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.style.fontStyle = 'italic';
        contentDiv.style.color = '#666';
        
        const completionText = 'Đã hoàn thành phân tích. Bạn có câu hỏi nào khác không?';
        const p = document.createElement('p');
        p.textContent = '';
        
        const statsContainer = document.createElement('div');
        statsContainer.className = 'completion-stats';
        statsContainer.style.marginTop = '12px';
        statsContainer.style.display = 'flex';
        statsContainer.style.alignItems = 'center';
        statsContainer.style.gap = '20px';
        statsContainer.style.paddingTop = '12px';
        statsContainer.style.borderTop = '1px solid #e0e0e0';
        
        const timeContainer = document.createElement('div');
        timeContainer.style.display = 'flex';
        timeContainer.style.alignItems = 'center';
        timeContainer.style.gap = '1px';
        const timeIcon = document.createElement('span');
        timeIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
        timeIcon.style.display = 'flex';
        timeIcon.style.alignItems = 'center';
        const timeText = document.createElement('span');
        timeText.textContent = `${elapsedTime}s`;
        timeText.style.fontWeight = '600';
        timeContainer.appendChild(timeIcon);
        timeContainer.appendChild(timeText);
        
        const costContainer = document.createElement('div');
        costContainer.style.display = 'flex';
        costContainer.style.alignItems = 'center';
        costContainer.style.gap = '1px';
        const costIcon = document.createElement('span');
        costIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>';
        costIcon.style.display = 'flex';
        costIcon.style.alignItems = 'center';
        const costText = document.createElement('span');
        costText.textContent = '9.99';
        costText.style.fontWeight = '600';
        costContainer.appendChild(costIcon);
        costContainer.appendChild(costText);
        
        statsContainer.appendChild(timeContainer);
        statsContainer.appendChild(costContainer);
        
        contentDiv.appendChild(p);
        contentDiv.appendChild(statsContainer);
        completionDiv.appendChild(avatar);
        completionDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(completionDiv);
        
        if (this.autoScrollEnabled) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
        
        this.streamText(p, completionText, () => {
            this.isStreaming = false;
            this.updateLoadingIndicator();
        });
    }

    /**
     * Stream text character by character
     */
    streamText(element, text, onComplete) {
        this.isStreaming = true;
        this.updateLoadingIndicator();
        
        let index = 0;
        const streamInterval = setInterval(() => {
            if (index < text.length) {
                element.textContent = text.substring(0, index + 1);
                index++;
                if (this.autoScrollEnabled) {
                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                }
            } else {
                clearInterval(streamInterval);
                this.isStreaming = false;
                this.updateLoadingIndicator();
                if (onComplete) {
                    onComplete();
                }
            }
        }, 18);
    }

    /**
     * Add message to chat
     */
    addMessage(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const avatar = document.createElement('div');
        avatar.className = `message-avatar ${sender}-avatar`;
        if (sender === 'user') {
            avatar.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
        } else {
            avatar.textContent = '🤖';
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (sender === 'system') {
            contentDiv.style.color = '#1565c0';
        }
        
        this._renderPlainTextContent(contentDiv, content);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);

        this.chatMessages.appendChild(messageDiv);
        
        if (this.autoScrollEnabled) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    /**
     * Render plain text content
     */
    _renderPlainTextContent(contentDiv, content) {
        const paragraphs = content.split('\n').filter(p => p.trim());
        paragraphs.forEach(paragraph => {
            const p = document.createElement('p');
            p.textContent = paragraph;
            contentDiv.appendChild(p);
        });
    }

    /**
     * Insert a small divider
     */
    addDivider() {
        const spacer = document.createElement('div');
        spacer.style.height = '8px';
        spacer.style.clear = 'both';
        this.chatMessages.appendChild(spacer);
    }

    /**
     * Set waiting state - open/close door for receiving messages
     */
    setWaitingState(waiting) {
        this.isWaitingForResponse = waiting;
        
        if (waiting) {
            this.questionInput.disabled = true;
            this.sendBtn.disabled = true;
            this.isStreaming = false;
        } else {
            this.questionInput.disabled = false;
            this.updateSendButtonState();
            this.removeLoadingIndicator();
        }
        this.updateLoadingIndicator();
    }

    /**
     * Update loading indicator - show when waiting for response and no message is streaming
     */
    updateLoadingIndicator() {
        if (this.isWaitingForResponse && !this.isStreaming && !this.isRendering) {
            if (!this.loadingIndicator || !this.loadingIndicator.parentElement) {
                this.addDivider();
                const loadingMessageDiv = document.createElement('div');
                loadingMessageDiv.className = 'message bot-message';
                
                const avatar = document.createElement('div');
                avatar.className = 'message-avatar bot-avatar';
                avatar.textContent = '🤖';
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                contentDiv.style.minHeight = '40px';
                
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading-dots';
                loadingDiv.innerHTML = `
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                `;
                
                contentDiv.appendChild(loadingDiv);
                loadingMessageDiv.appendChild(avatar);
                loadingMessageDiv.appendChild(contentDiv);
                this.chatMessages.appendChild(loadingMessageDiv);
                
                this.loadingIndicator = loadingMessageDiv;
                if (this.autoScrollEnabled) {
                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                }
            }
        } else {
            this.removeLoadingIndicator();
        }
    }

    /**
     * Remove loading indicator
     */
    removeLoadingIndicator() {
        if (this.loadingIndicator && this.loadingIndicator.parentElement) {
            this.loadingIndicator.remove();
            this.loadingIndicator = null;
        }
    }

    /**
     * Remove loading indicator from specific content div
     */
    removeLoadingIndicatorFromContent(contentDiv) {
        const loadingIndicator = contentDiv.querySelector('.streaming-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    /**
     * Update send button state
     */
    updateSendButtonState() {
        const hasQuestion = this.questionInput.value.trim().length > 0;
        const canSend = hasQuestion && !this.isWaitingForResponse;
        this.sendBtn.disabled = !canSend;
    }

    /**
     * Adjust textarea height automatically
     */
    adjustTextareaHeight() {
        this.questionInput.style.height = 'auto';
        this.questionInput.style.height = Math.min(this.questionInput.scrollHeight, 120) + 'px';
        this.updateSendButtonState();
    }

    /**
     * Create placeholder for streaming message
     */
    createStreamingMessagePlaceholder() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar bot-avatar';
        avatar.textContent = '🤖';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content streaming-content';
        contentDiv.dataset.streaming = 'true';

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        
        if (this.autoScrollEnabled) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
        
        contentDiv.messageDiv = messageDiv;
        
        return contentDiv;
    }

    /**
     * Add loading indicator
     */
    addLoadingIndicator(contentDiv) {
        this.removeLoadingIndicatorFromContent(contentDiv);
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'streaming-loading-indicator';
        
        loadingDiv.innerHTML = `
            <svg width="40" height="20" viewBox="0 0 120 30" xmlns="http://www.w3.org/2000/svg" fill="#667eea">
                <circle cx="15" cy="15" r="10">
                    <animate attributeName="r" from="10" to="10" begin="0s" dur="0.8s" values="10;12;10" calcMode="linear" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="1" to="1" begin="0s" dur="0.8s" values="1;.5;1" calcMode="linear" repeatCount="indefinite" />
                </circle>
                <circle cx="60" cy="15" r="10">
                    <animate attributeName="r" from="10" to="10" begin="0.2s" dur="0.8s" values="10;12;10" calcMode="linear" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="1" to="1" begin="0.2s" dur="0.8s" values="1;.5;1" calcMode="linear" repeatCount="indefinite" />
                </circle>
                <circle cx="105" cy="15" r="10">
                    <animate attributeName="r" from="10" to="10" begin="0.4s" dur="0.8s" values="10;12;10" calcMode="linear" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="1" to="1" begin="0.4s" dur="0.8s" values="1;.5;1" calcMode="linear" repeatCount="indefinite" />
                </circle>
            </svg>
        `;
        
        contentDiv.appendChild(loadingDiv);
        
        if (this.autoScrollEnabled) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Save message queue to localStorage
     */
    saveQueueToLocalStorage() {
        if (!this.sessionId) return;
        
        try {
            const key = `messageQueue_${this.sessionId}`;
            localStorage.setItem(key, JSON.stringify({
                queue: this.messageQueue,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Error saving queue to localStorage:', error);
        }
    }

    /**
     * Load message queue from localStorage
     */
    loadQueueFromLocalStorage() {
        if (!this.sessionId) return;
        
        try {
            const key = `messageQueue_${this.sessionId}`;
            const data = localStorage.getItem(key);
            
            if (data) {
                const parsed = JSON.parse(data);
                // Only load if data is fresh (within 1 hour)
                if (Date.now() - parsed.timestamp < 3600000) {
                    this.messageQueue = parsed.queue || [];
                    console.log('Loaded queue from localStorage:', this.messageQueue.length, 'messages');
                } else {
                    localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.error('Error loading queue from localStorage:', error);
        }
    }

    /**
     * Remove first message from localStorage
     */
    removeMessageFromLocalStorage() {
        if (!this.sessionId) return;
        
        try {
            const key = `messageQueue_${this.sessionId}`;
            const data = localStorage.getItem(key);
            
            if (data) {
                const parsed = JSON.parse(data);
                parsed.queue = this.messageQueue;
                localStorage.setItem(key, JSON.stringify(parsed));
            }
        } catch (error) {
            console.error('Error removing message from localStorage:', error);
        }
    }

    /**
     * Clear localStorage queue
     */
    clearLocalStorageQueue() {
        if (!this.sessionId) return;
        
        try {
            const key = `messageQueue_${this.sessionId}`;
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error clearing localStorage queue:', error);
        }
        
        // Cleanup old keys
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('messageQueue_')) {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        // Remove data older than 1 hour
                        if (Date.now() - parsed.timestamp > 3600000) {
                            localStorage.removeItem(key);
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error cleaning up old localStorage keys:', error);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.factCheckingManager = new FactCheckingManager();
});
