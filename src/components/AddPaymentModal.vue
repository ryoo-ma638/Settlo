<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content slide-up">
        
        <div class="modal-header">
          <h2 class="modal-title">{{ editData ? '支払いを編集' : '新しく支払いを追加' }}</h2>
          <button class="close-btn" :disabled="batchBusy" @click="closeModal" aria-label="閉じる">×</button>
        </div>

        <div v-if="!editData && eventId" class="receipt-mode" role="tablist" aria-label="支払いの入力方法">
          <button type="button" role="tab" :aria-selected="!batchMode" :class="{ active: !batchMode }" :disabled="batchBusy || batchReading || batchCards.some(c => c.state === 'unknown' || c.state === 'saveFailed') || batchRecoveryError" @click="batchMode = false">1件ずつ入力</button>
          <button type="button" role="tab" :aria-selected="batchMode" :class="{ active: batchMode }" :disabled="isAnalyzing" @click="batchMode = true">複数レシート</button>
        </div>
        <div v-if="batchMode && !editData" class="modal-body scroll-area batch-body">
          <p v-if="!participants.length" role="status">参加者を読み込むまで登録できません。</p>
          <p v-if="eventEnded" role="status">終了済みのイベントには新しく登録できません。</p>
          <input ref="batchFileInput" class="hidden-input" type="file" accept="image/*" multiple @change="onBatchFiles">
          <input ref="batchCameraInput" class="hidden-input" type="file" accept="image/*" capture="environment" @change="onBatchFiles">
          <template v-if="!batchFinished">
            <div class="batch-drop-zone" :class="{ 'is-dragover': batchDragging, 'is-disabled': !batchCanAdd }"
              @dragenter.prevent="onBatchDragOver" @dragover.prevent="onBatchDragOver" @dragleave.prevent="onBatchDragLeave" @drop.prevent="onBatchDrop">
              <div class="batch-capture-actions">
                <button type="button" class="batch-capture-button" :disabled="!batchCanAdd" @click="batchCameraInput.click()">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>
                  <strong>カメラで撮影</strong><span>1枚ずつ追加</span>
                </button>
                <button type="button" class="batch-capture-button" :disabled="!batchCanAdd" @click="batchFileInput.click()">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/></svg>
                  <strong>アルバムから</strong><span>最大5枚を選択</span>
                </button>
              </div>
              <p class="batch-drop-copy">PCでは、ここに画像をドラッグしても追加できます</p>
            </div>
            <p class="batch-photo-hint">レシート全体が入るように、1枚ずつ大きく写してください。画像は縮小せずに読み取ります。</p>
            <section class="batch-intro" aria-labelledby="batch-intro-title">
              <div class="batch-intro-head">
                <h3 id="batch-intro-title">レシートを1枚ずつ確認</h3>
                <span>{{ batchCards.length }} / 5枚</span>
              </div>
              <p>写真1枚につきレシート1枚。1回5枚まで順番に読み取り、登録後は続けて追加できます。</p>
            </section>
          </template>
          <section v-else class="batch-complete" role="status">
            <span class="batch-complete-icon" aria-hidden="true">✓</span>
            <div><h3>{{ batchSavedCount }}件の支払いを保存しました</h3><p>合計 {{ batchSavedTotal.toLocaleString('ja-JP') }}円・レシートごとに別の支払いとして登録しています。</p></div>
          </section>
          <p v-if="batchMessage && !batchFinished" role="status" class="batch-message">{{ batchMessage }}</p>
          <fieldset v-for="(card, index) in batchCards" :key="card.id" class="batch-entry" :disabled="batchBusy">
            <legend>{{ index + 1 }}枚目のレシート</legend>
            <article v-if="['saved', 'excluded'].includes(card.state)" class="batch-finished-card" :class="{ excluded: card.state === 'excluded' }">
              <div class="batch-finished-main"><span>{{ index + 1 }}枚目</span><div><strong>{{ card.store || '店名なし' }}</strong><small>{{ card.date || '日付なし' }}</small></div><b>{{ /^\d+$/.test(card.amount) ? Number(card.amount).toLocaleString('ja-JP') + '円' : '金額なし' }}</b></div>
              <p v-if="card.state === 'excluded'">登録から除外しました。</p>
              <template v-else>
                <p v-if="card.reasonText" class="batch-finished-warning" role="status">{{ card.reasonText }}</p>
                <details><summary>精算内容を確認</summary><p>{{ card.plan.payment.payer }}が立替え ・ {{ batchSplitLabel(card.plan.payment.splitType) }}</p><div class="batch-share-preview"><span v-for="share in card.plan.shares" :key="share.uid">{{ share.name }} {{ share.amount.toLocaleString('ja-JP') }}円</span></div></details>
              </template>
            </article>
            <ReceiptResultCard v-else :number="index + 1" :store="card.store" :amount="card.amount" :date="card.date" :state="card.state" :reason-text="card.reasonText" :receipt="card.receipt" :image="card.image"
              @update:store="updateBatchStore(card, $event)" @update:amount="updateBatchAmount(card, $event)" @update:date="updateBatchDate(card, $event)"
              @remove="excludeBatchCard(card)" @restore="restoreBatchCard(card)" />
            <section v-if="!card.plan && !['reading', 'excluded'].includes(card.state)" class="batch-settlement" :aria-labelledby="`batch-settlement-${card.id}`">
              <div class="batch-settlement-head">
                <h4 :id="`batch-settlement-${card.id}`">2. このレシートの精算</h4>
                <span :class="{ confirmed: card.settlementConfirmed }">{{ card.settlementConfirmed ? '確認済み' : '未確認' }}</span>
              </div>
              <label class="batch-field">立替えた人
                <select :value="card.payerUid" class="standard-input" @change="updateBatchPayer(card, $event.target.value)">
                  <option value="" disabled>選んでください</option>
                  <option v-for="p in participants" :key="p.id" :value="p.id">{{ p.name }}{{ p.id === myUid ? '（自分）' : '' }}</option>
                </select>
              </label>
              <div class="batch-split-tabs" role="group" aria-label="割り方">
                <button type="button" :class="{ active: card.splitType === 'all' }" @click="setBatchSplitType(card, 'all')">全員で均等</button>
                <button type="button" :class="{ active: card.splitType === 'custom' }" @click="setBatchSplitType(card, 'custom')">金額を指定</button>
                <button type="button" :class="{ active: card.splitType === 'item' }" :disabled="!batchCanUseItemSplit(card)" @click="setBatchSplitType(card, 'item')">商品ごと</button>
              </div>
              <p v-if="!batchCanUseItemSplit(card)" class="batch-settlement-note">明細の金額がすべて読み取れた場合のみ、商品ごとに分けられます。</p>
              <div v-if="card.splitType === 'custom'" class="batch-custom-grid">
                <label v-for="p in participants" :key="p.id">{{ p.name }}
                  <span><input type="text" inputmode="numeric" pattern="[0-9]*" :value="card.customAmounts[p.id]" @input="updateBatchCustomAmount(card, p.id, $event.target.value)">円</span>
                </label>
              </div>
              <div v-if="card.splitType === 'item'" class="batch-item-splits">
                <div v-for="(item, itemIndex) in card.allocationItems" :key="itemIndex" class="batch-item-split">
                  <p><strong>{{ item.name || '品目名不明' }}</strong><span>{{ Number(item.price).toLocaleString('ja-JP') }}円</span></p>
                  <div><button v-for="p in participants" :key="p.id" type="button" :class="{ active: item.assigneeUids.includes(p.id) }" @click="toggleBatchItemAssignee(card, item, p.id)">{{ p.name }}</button></div>
                </div>
              </div>
              <div class="batch-share-preview">
                <strong>登録する負担額</strong>
                <template v-if="batchSettlementPreview(card).ok">
                  <span v-for="share in batchSettlementPreview(card).shares" :key="share.uid">{{ share.name }} {{ share.amount.toLocaleString('ja-JP') }}円</span>
                </template>
                <p v-else role="status">{{ batchSettlementPreview(card).message }}</p>
              </div>
              <button type="button" class="batch-confirm-settlement" :class="{ confirmed: card.settlementConfirmed }" :disabled="card.state !== 'ready' || !batchSettlementPreview(card).ok" @click="confirmBatchSettlement(card)">
                {{ card.settlementConfirmed ? '精算内容を確認済み' : 'この精算内容を確認' }}
              </button>
            </section>
            <section v-else-if="card.plan && !['saved', 'excluded'].includes(card.state)" class="batch-settlement batch-settlement-frozen">
              <div class="batch-settlement-head"><h4>2. このレシートの精算</h4><span class="confirmed">確認済み</span></div>
              <p>{{ card.plan.payment.payer }}が立替え ・ {{ batchSplitLabel(card.plan.payment.splitType) }}</p>
              <div class="batch-share-preview"><span v-for="share in card.plan.shares" :key="share.uid">{{ share.name }} {{ share.amount.toLocaleString('ja-JP') }}円</span></div>
            </section>
            <button v-if="card.state === 'unknown'" type="button" class="batch-secondary" :disabled="batchBusy" @click="confirmBatchCard(card)">保存結果を確認</button>
            <button v-if="card.state === 'saveFailed'" type="button" class="batch-secondary" :disabled="batchBusy || batchRecoveryError || eventEnded" @click="saveBatchCards([card])">同じ登録情報で再送</button>
          </fieldset>
          <p v-if="batchCards.length && !batchFinished" role="status" class="batch-message">{{ batchSummary }}</p>
        </div>
        <div v-else class="modal-body scroll-area">
          
          <div class="upload-section">
            <input type="file" ref="cameraInput" accept="image/*" capture="environment" class="hidden-input" @change="handleFileUpload">
            <input type="file" ref="fileInput" accept="image/*" class="hidden-input" @change="handleFileUpload">
            
            <div 
              class="drop-zone" 
              :class="{ 'is-dragover': isDragging, 'is-analyzing': isAnalyzing }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
            >
              <div v-if="!uploadedImage && !isAnalyzing" class="upload-placeholder">
                <p class="upload-hint">レシートを読み取って自動入力</p>
                <div class="upload-actions">
                  <button class="upload-action-btn" @click="$refs.cameraInput.click()">
                    <svg class="upload-action-btn__icon" viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>
                    カメラで撮影
                  </button>
                  <button class="upload-action-btn" @click="$refs.fileInput.click()">
                    <svg class="upload-action-btn__icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/></svg>
                    アルバムから
                  </button>
                </div>
              </div>

              <div v-else-if="isAnalyzing" class="analyzing-view">
                <div class="scan-line"></div>
                <img :src="uploadedImage" class="scanning-img">
                <div class="analyzing-text">
                  <span class="spinner"></span> AIがレシートを解析中...
                </div>
              </div>

              <div v-else class="upload-preview">
                <img :src="uploadedImage" alt="レシート画像" class="preview-img">
                <div class="success-badge">読み取り完了</div>
                <button class="re-upload-btn" @click.stop="resetUpload">やり直す</button>
              </div>
            </div>
          </div>

          <!-- 🌟 レシート読み取りの注意（通貨がちがう・ポイント利用など、金額の扱いに関わることだけ出す） -->
          <div v-if="receiptNotices.length" class="ocr-notice">
            <p v-for="(n, i) in receiptNotices" :key="i" class="ocr-notice-line">{{ n }}</p>
          </div>

          <div class="basic-info-card">
            <div class="input-row amount-row">
              <label>合計金額</label>
              <div class="amount-input-wrapper">
                <span class="currency-mark">¥</span>
                <input v-model="formData.amount" type="tel" class="amount-input" placeholder="0" @change="calculateRemaining">
                <span class="currency-unit">円</span>
              </div>
            </div>

            <div class="input-row">
              <label>店名・内容</label>
              <input v-model="formData.itemName" type="text" class="standard-input" placeholder="例: 鳥貴族">
            </div>

            <div class="input-row">
              <label>事業者登録番号 <span class="hint-text">(任意・レシートから自動取得)</span></label>
              <input v-model="formData.registrationNumber" type="text" class="standard-input" placeholder="例: T1234567890123">
            </div>

            <div class="input-row half-row">
              <div class="half">
                <label>日付</label>
                <input v-model="formData.date" type="date" class="standard-input">
              </div>
              <div class="half">
                <label>時間 <span class="hint-text">(任意)</span></label>
                <input v-model="formData.time" type="time" class="standard-input">
              </div>
            </div>

            <div class="input-row">
              <label>立替えた人</label>
              <select v-model="formData.payer" class="standard-input select-style">
                <option v-if="participants.length === 0" disabled value="">参加者がいません</option>
                <option v-for="p in participants" :key="p.id || p.name" :value="p.name">
                  {{ p.isMe ? p.name + '（自分）' : p.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="category-section">
            <h3 class="section-sub-title">ジャンル</h3>
            <div class="category-row">
              <button
                v-for="c in categories" :key="c" type="button"
                class="cat-chip" :class="{ active: formData.category === c }"
                @click="formData.category = c"
              >
                <span class="cat-icon"><GenreIcon :type="c" /></span>
                <span class="cat-label">{{ c }}</span>
              </button>
            </div>
          </div>

          <div class="split-type-section">
            <h3 class="section-sub-title">割り勘の方法</h3>
            <div class="ios-segmented-control">
              <button :class="{ active: formData.splitType === 'all' }" @click="formData.splitType = 'all'">全員で均等</button>
              <button :class="{ active: formData.splitType === 'custom' }" @click="formData.splitType = 'custom'">金額を指定</button>
              <button :class="{ active: formData.splitType === 'item' }" @click="formData.splitType = 'item'">商品ごとに指定</button>
            </div>
          </div>

          <div v-if="formData.splitType === 'all'" class="dynamic-section slide-in">
            <div class="split-result-box">
              <span class="split-desc">参加者全員で均等に割り勘します。</span>
              <h2 class="split-calc-amount">1人あたり ¥{{ calculatedSplitAmount }}</h2>
            </div>
          </div>

          <div v-if="formData.splitType === 'custom'" class="dynamic-section slide-in">
            <div class="custom-split-header">
              <p class="section-desc">誰がいくら払うかを入力してください。</p>
              <span class="remaining-text" :class="{ 'error': remainingAmount < 0 }">
                残り: ¥{{ remainingAmount.toLocaleString() }}
              </span>
            </div>
            
            <div class="custom-split-list">
              <div class="custom-item" v-for="p in participants" :key="p.name">
                <div class="user-info">
                  <UserAvatar class="avatar-small" :name="p.name" :photo="p.photo" :size="28" />
                  <span>{{ p.name }}</span>
                </div>
                <div class="custom-input-box">
                  <span>¥</span>
                  <input 
                    v-model="customSplitAmounts[p.name]" 
                    type="tel" 
                    placeholder="0"
                    @blur="calculateRemaining"
                  >
                  <span>円</span>
                </div>
              </div>
            </div>
            <p class="ai-hint">最後の1人は、残りの金額が自動で入力されます</p>
          </div>

          <div v-if="formData.splitType === 'item'" class="dynamic-section slide-in">
            <div class="item-split-header">
              <div class="header-left">
                <p class="section-desc">商品ごとに支払う人を選べます。金額欄はその行の合計（数量ぶん込み）です。</p>
                <p class="match-status" :class="{'matched': itemsTotal === Number(formData.amount), 'error': itemsTotal !== Number(formData.amount)}">
                  内訳合計: ¥{{ itemsTotal.toLocaleString() }} / 全体: ¥{{ Number(formData.amount).toLocaleString() }}
                </p>
              </div>
              <button class="add-item-btn" @click="addDummyItem">＋ 商品追加</button>
            </div>

            <div class="tax-mode-box">
              <p class="tax-mode-title">税の計算方法 <span class="hint-text">(レシートから自動判定・変更可)</span></p>
              <div class="tax-mode-seg">
                <button :class="{ active: taxMode === 'included' }" @click="taxMode = 'included'">価格は税込</button>
                <button :class="{ active: taxMode === 'aggregate' }" @click="taxMode = 'aggregate'">税抜 → 合計に課税</button>
                <button :class="{ active: taxMode === 'perItem' }" @click="taxMode = 'perItem'">税抜 → 商品ごと課税</button>
              </div>
              <p class="tax-mode-desc">{{ taxModeDesc }}</p>
            </div>

            <div v-if="taxMode !== 'included'" class="global-tax-control">
              <span>税率を一括設定:</span>
              <button class="global-tax-btn" @click="setGlobalTax(8)">すべて8%</button>
              <button class="global-tax-btn" @click="setGlobalTax(10)">すべて10%</button>
            </div>

            <div class="receipt-items-list">
              <div v-if="receiptItems.length === 0" class="empty-items">レシートを読み取るとここに商品が並びます</div>
              
              <div class="receipt-item-card" v-for="(item, index) in receiptItems" :key="index">
                <div class="item-main-row">
                  <input v-model="item.name" class="item-name-input" placeholder="商品名">
                  <button class="remove-item-btn" @click="receiptItems.splice(index, 1)" aria-label="削除">
                    <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
                  </button>
                </div>
                
                <div class="item-math-row">
                  <div class="price-input-wrapper">
                    <span>¥</span><input v-model="item.price" type="tel" class="item-price-input" placeholder="金額">
                  </div>
                  <div class="qty-control">
                    <button @click="item.qty > 1 && item.qty--">-</button>
                    <span>{{ item.qty }}点</span>
                    <button @click="item.qty++">+</button>
                  </div>
                  <button v-if="taxMode !== 'included'" class="tax-toggle-btn" :class="'tax-' + item.taxRate" @click="toggleTax(item)">
                    {{ item.taxRate === 0 ? '0%' : `${item.taxRate}%` }}
                  </button>
                </div>

                <div class="item-subtotal">
                  小計{{ taxMode === 'aggregate' ? '（税抜）' : '' }}: <strong>¥{{ calcItemTotal(item).toLocaleString() }}</strong>
                </div>
                
                <div class="item-assignees">
                  <span class="assign-label">支払う人:</span>
                  <div class="assign-chips">
                    <button 
                      v-for="p in participants" :key="p.name"
                      class="chip"
                      :class="{ 'selected': item.assignees.includes(p.name) }"
                      @click="toggleAssignee(item, p.name)"
                    >
                      {{ p.name.split(' ')[0] }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 🌟 合計チェック＆不明な残金の処理（内訳を使う割り勘のとき常に表示） -->
          <div v-if="(formData.splitType === 'item' || formData.splitType === 'custom') && Number(formData.amount) > 0" class="total-summary">
            <div class="ts-row"><span>内訳の合計</span><b>¥{{ breakdownTotal.toLocaleString() }}</b></div>
            <div class="ts-row"><span>会計総額</span><b>¥{{ Number(formData.amount).toLocaleString() }}</b></div>

            <div v-if="remainderDiff !== 0" class="remainder-box">
              <p class="rb-title">{{ remainderText }}</p>
              <div class="rb-field">
                <label>差額（不明な残金）を負担する人</label>
                <select v-model="remainderBearer" class="standard-input select-style">
                  <option value="">{{ formData.payer || '立替者' }}（立替者）</option>
                  <option v-for="p in participants" :key="p.id || p.name" :value="p.name">{{ p.name }}</option>
                </select>
              </div>
              <div class="rb-field">
                <label>理由 <span class="hint-text">(任意)</span></label>
                <input v-model="remainderReason" type="text" class="standard-input" placeholder="例: お店の端数処理・レジの誤差">
              </div>
            </div>
            <div v-else class="ts-ok">金額が一致しています</div>
          </div>
        </div>

        <div class="modal-footer">
          <MessageField v-if="editData" v-model="editNote" class="edit-note" label="変更のひとこと（任意）" placeholder="例：金額を打ち間違えたので直しました" />

          <button v-if="batchMode && !editData && batchFinished" class="submit-btn" @click="startNextBatch">続けてレシートを追加</button>
          <button v-else-if="batchMode && !editData" class="submit-btn" :disabled="!batchCanSave" @click="saveBatchCards(batchTargets)">{{ batchPrimaryLabel }}</button>
          <button v-else class="submit-btn" :disabled="isSubmitting" @click="handleSubmit">{{ editData ? 'この内容で保存する' : 'この内容で追加する' }}</button>
        </div>

      </div>
    </div>

    <BaseModal
      :show="modalState.show"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      :showCancel="modalState.showCancel"
      :confirmText="modalState.confirmText"
      :cancelText="modalState.cancelText"
      @confirm="handleConfirmModal"
      @cancel="modalState.show = false"
      @close="modalState.show = false"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue';
import BaseModal from '../components/BaseModal.vue';
import MessageField from '../components/MessageField.vue';
import GenreIcon from '../components/GenreIcon.vue'; // 🌟 支払いジャンルのアイコン
import UserAvatar from '../components/UserAvatar.vue';
import { app } from "../firebase";
import ReceiptResultCard from './ReceiptResultCard.vue';
import { evenShares } from '../lib/evenShares.js';
import { getBatchCardState } from '../lib/batchStates.js';
import { MAX_AMOUNT, isValidPaymentDate, validateSavePlan, prepareSaveIds, saveOnePayment, confirmSavedOnServer, recoverPaymentSideEffects } from '../lib/batchPaymentSave.js';
import { publishPaymentAddedNotifications } from '../lib/paymentAddedNotifications.js';
import { getFunctions, httpsCallable } from "firebase/functions"; // ← AI通信に必要なこれらが抜けていました！

// 🌟 支払いのジャンル候補
const categories = ['食事', 'カフェ', 'コンビニ', 'スーパー', '買い物', '交通', '旅行', '遊び', '飲み会', 'その他'];

// 🌟 統一モーダルの状態管理
const modalState = reactive({
  show: false, type: 'info', title: '', message: '', 
  showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null
});
const showModal = (options) => {
  Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, ...options, show: true });
};
const handleConfirmModal = () => {
  if (modalState.onConfirm) modalState.onConfirm();
  modalState.show = false;
};

// 🌟 実データ化：イベントの参加者（{ id, name, color/photo, isMe }）を親から受け取る
const props = defineProps({
  isOpen: Boolean,
  eventId: { type: String, default: '' },
  eventName: { type: String, default: '' },
  eventEnded: { type: Boolean, default: false },
  participants: { type: Array, default: () => [] },
  myName: { type: String, default: '' },
  myUid: { type: String, default: '' },
  editData: { type: Object, default: null }, // 🌟 編集対象（nullなら新規追加）
});
const emit = defineEmits(['close', 'submit']);

// --- 状態管理 ---
const cameraInput = ref(null);
const fileInput = ref(null);
const isDragging = ref(false);
const uploadedImage = ref(null);
const isAnalyzing = ref(false);

const formData = ref({
  amount: '',
  itemName: '',
  date: new Date().toISOString().split('T')[0],
  time: '',
  payer: '',
  category: '食事', // 🌟 支払いジャンル
  splitType: 'all',
  registrationNumber: '' // 🌟 事業者登録番号（インボイス・レシートOCRで取得）
});

// 🌟 参加者は親（イベント）から渡された実データを使う
const participants = computed(() => props.participants || []);

const receiptItems = ref([]);

// 🌟 レシート読み取りの注意書き（通貨がちがう／ポイント利用など、本人に判断してほしいこと）
const receiptNotices = ref([]);

const customSplitAmounts = ref({});

// 🌟 参加者が変わるたびに、金額指定の入力欄と「立替えた人」の初期値を作り直す
watch(participants, (list) => {
  const arr = list || [];
  const next = {};
  arr.forEach(p => { next[p.name] = customSplitAmounts.value[p.name] ?? ''; });
  customSplitAmounts.value = next;
  // 立替えた人の初期値：自分 → 先頭参加者の順で決める
  if (!formData.value.payer || !arr.find(p => p.name === formData.value.payer)) {
    const me = arr.find(p => p.isMe);
    formData.value.payer = me ? me.name : (arr[0]?.name || props.myName || '');
  }
}, { immediate: true, deep: true });

// 🌟 フォームを新規状態にリセット
const resetForm = () => {
  formData.value.amount = '';
  formData.value.itemName = '';
  formData.value.date = new Date().toISOString().split('T')[0];
  formData.value.time = '';
  formData.value.category = '食事';
  formData.value.splitType = 'all';
  formData.value.registrationNumber = '';
  taxMode.value = 'included';
  remainderBearer.value = '';
  remainderReason.value = '';
  receiptItems.value = [];
  receiptNotices.value = [];
  uploadedImage.value = null;
  isAnalyzing.value = false;
  const next = {};
  (props.participants || []).forEach(p => { next[p.name] = ''; });
  customSplitAmounts.value = next;
  const me = (props.participants || []).find(p => p.isMe);
  formData.value.payer = me ? me.name : (props.myName || (props.participants || [])[0]?.name || '');
};

// 🌟 編集対象の内容をフォームに流し込む
const prefillFromEdit = (d) => {
  formData.value.amount = String(d.amount ?? '');
  formData.value.itemName = d.itemName || '';
  formData.value.date = d.date ? String(d.date).replace(/\//g, '-') : new Date().toISOString().split('T')[0];
  formData.value.time = d.time || '';
  formData.value.category = d.category || 'その他';
  formData.value.splitType = d.splitType || 'all';
  formData.value.registrationNumber = d.registrationNumber || '';
  formData.value.payer = d.payer || '';
  taxMode.value = d.taxMode || 'included';
  remainderBearer.value = d.remainder?.name || '';
  remainderReason.value = d.remainder?.reason || '';
  const next = {};
  (props.participants || []).forEach(p => { next[p.name] = ''; });
  (d.shares || []).forEach(s => { if (s && s.name != null) next[s.name] = Number(s.amount) || ''; });
  customSplitAmounts.value = next;
  receiptItems.value = (d.items || []).map(it => ({
    name: it.name || '',
    // 金額欄は「行の合計（印字どおり）」。
    // lineTotal を持たない古い記録は rawPrice が単価なので、数量を掛けて行の合計に戻す。
    price: it.lineTotal != null
      ? it.lineTotal
      : (it.rawPrice != null ? Number(it.rawPrice) * (it.qty || 1) : (it.price || 0)),
    qty: it.qty || 1,
    taxRate: it.taxRate != null ? it.taxRate : 0,
    assignees: it.assignees || [],
  }));
  receiptNotices.value = [];
  uploadedImage.value = null;
  isAnalyzing.value = false;
};

// 🌟 モーダルを開くたび、編集ならその内容を、新規なら初期状態に
watch(() => props.isOpen, (open) => {
  if (!open) return;
  isSubmitting.value = false; // 🌟 再オープン時にガードを解除（コンポーネントは破棄されず残るため）
  if (props.editData) prefillFromEdit(props.editData);
  else resetForm();
});

// --- 計算ロジック ---
const calculatedSplitAmount = computed(() => {
  const amt = Number(formData.value.amount);
  const count = participants.value.length || 1;
  if (!amt || isNaN(amt)) return 0;
  return Math.floor(amt / count).toLocaleString();
});



const remainingAmount = computed(() => {
  const total = Number(formData.value.amount) || 0;
  let entered = 0;
  for (const name in customSplitAmounts.value) {
    const val = Number(customSplitAmounts.value[name]);
    if (!isNaN(val)) entered += val;
  }
  return total - entered;
});

const calculateRemaining = () => {
  const total = Number(formData.value.amount) || 0;
  let enteredTotal = 0;
  let emptyKeys = [];

  for (const name in customSplitAmounts.value) {
    const val = customSplitAmounts.value[name];
    if (val !== '' && val !== null && !isNaN(val)) {
      enteredTotal += Number(val);
    } else {
      emptyKeys.push(name);
    }
  }

  if (emptyKeys.length === 1) {
    const remaining = total - enteredTotal;
    customSplitAmounts.value[emptyKeys[0]] = remaining > 0 ? remaining : 0;
  }
};

// --- アクション ---
const closeModal = () => { if (!batchBusy.value) emit('close'); };


const resetUpload = () => {
  formData.value.amount = '';
  formData.value.itemName = '';
  formData.value.time = '';
  uploadedImage.value = null;
  isAnalyzing.value = false;
  receiptItems.value = [];
  receiptNotices.value = [];
  remainderReason.value = '';
  participants.value.forEach(p => customSplitAmounts.value[p.name] = '');
};

// --- 🌟 本物のAIを呼び出す処理に書き換え！ ---
const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (file) processImage(file);
};
const handleDrop = (e) => {
  isDragging.value = false;
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processImage(file);
};

const processImage = (file) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    uploadedImage.value = e.target.result;
    isAnalyzing.value = true; // アニメーション開始
    
    try {
      // Firebase Functions（本物のAI）を呼び出す
      const functions = getFunctions(app, 'asia-northeast1');
      const analyzeReceipt = httpsCallable(functions, 'analyzeReceipt');
      
      const result = await analyzeReceipt({ image: uploadedImage.value });
      const data = result.data; // AIが返してきたJSONデータ！

      // フォームに自動入力
      // 🛡️ OCR結果の検証（AIの出力が乱れてもUIが壊れないようにクランプする）
      const safeNum = (v, min, max, dflt) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dflt;
      };
      const safeText = (v, len) => (typeof v === 'string' ? v.trim().slice(0, len) : '');

      const notices = [];

      formData.value.itemName = safeText(data.storeName, 60) || '不明な店舗';

      // 🌟 通貨のチェック：日本円でなければ金額を自動入力しない（外貨がそのまま円になる事故を防ぐ）
      const currency = safeText(data.currency, 8).toUpperCase();
      const isForeign = currency !== '' && currency !== 'JPY';
      const total = safeNum(data.totalAmount, 0, 99999999, 0);
      if (isForeign) {
        formData.value.amount = '';
        notices.push(`日本円以外のレシートの可能性があります（通貨: ${currency}）。合計金額は自動入力していません。`);
      } else {
        formData.value.amount = total > 0 ? String(total) : '';
      }

      if (typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) formData.value.date = data.date;
      // 🌟 時刻はレシートに印字が無ければ空のまま（読めなかった時刻を勝手に埋めない）
      formData.value.time = (typeof data.time === 'string' && /^\d{1,2}:\d{2}$/.test(data.time)) ? data.time : '';
      const regNo = safeText(data.registrationNumber, 20);
      formData.value.registrationNumber = /^T\d{13}$/.test(regNo) ? regNo : ''; // 事業者登録番号（T+13桁のみ受理）

      // 🌟 ポイント利用があっても合計は「ポイントを引く前」のまま。事実だけメモに残す
      const points = safeNum(data.pointsUsed, 0, 99999999, 0);
      if (points > 0) {
        const memo = `ポイント利用 ¥${points.toLocaleString()}`;
        notices.push(`${memo}。合計はポイントを引く前の金額を入れています。`);
        // 同じレシートを読み直しても二重に足さない
        if (!remainderReason.value.includes(memo)) {
          remainderReason.value = remainderReason.value ? `${remainderReason.value} / ${memo}` : memo;
        }
      }

      // 🌟 税込/税抜をAIの判定から自動セット（税抜なら「合計してから課税」方式に）
      taxMode.value = data.taxIncluded === false ? 'aggregate' : 'included';

      // 🌟 商品ごとの税率もAIの判定をプリセット（8%か10%のボタンが押された状態にする）
      if (Array.isArray(data.items) && data.items.length > 0) {
        receiptItems.value = data.items.slice(0, 100).map(item => ({
          name: safeText(item.name, 60) || '不明な商品',
          // 金額は「その行の合計」。lineTotal が無い古い応答は price を行の合計として扱う（後方互換）
          // 値引・クーポン・返品はマイナスなので、下限を0にせず負の金額も受け取る
          price: safeNum(item.lineTotal != null ? item.lineTotal : item.price, -9999999, 9999999, 0),
          qty: safeNum(item.quantity, 1, 999, 1),
          taxRate: item.taxRate === 8 ? 8 : (item.taxRate === 10 ? 10 : (data.taxIncluded === false ? 10 : 8)),
          assignees: []
        }));
        formData.value.splitType = 'item'; // 商品タブに自動で切り替え
      }

      receiptNotices.value = notices;
    } catch (error) {
      console.error("読み取りエラー:", error);
      showModal({ type: 'error', title: '読み取りエラー', message: 'レシートの読み取りに失敗しました。手動で入力してください。' });
    } finally {
      isAnalyzing.value = false; // ← アニメーションを止める処理が抜けていました！
    }
  };
  reader.readAsDataURL(file); 
};
const toggleAssignee = (item, name) => {
  const idx = item.assignees.indexOf(name);
  if (idx > -1) item.assignees.splice(idx, 1);
  else item.assignees.push(name);
};
const addDummyItem = () => {
  receiptItems.value.push({ name: '', price: null, qty: 1, taxRate: 10, assignees: [] });
};

// 🌟 税の計算方法（レシートOCRが自動判定・手動でも変更可）
//   included  = 商品の価格がすでに税込 → そのまま合算
//   aggregate = 税抜価格 → 税率ごとにまとめて「合計してから」課税（レシートで最も一般的）
//   perItem   = 税抜価格 → 商品1つずつ課税（店によってはこちら）
const taxMode = ref('included');
const taxModeDesc = computed(() => {
  if (taxMode.value === 'included') return '商品の価格を税込として、そのまま合算します。';
  if (taxMode.value === 'aggregate') return '税抜価格を税率ごとに合算してから消費税をかけます（1円ずれが出にくい方式）。';
  return '商品1つずつに消費税をかけてから合算します。';
});

// 🌟 商品1行の金額＝入力欄の値そのもの（＝その行の合計。数量ぶんは既に含まれている）
//    数量を掛けると二重計上になるので掛けない。数量は表示のためだけに持つ。
const itemBase = (item) => Number(item.price) || 0;

// 🌟 小計・合計の計算ロジック（taxMode に応じて切替）
const calcItemTotal = (item) => {
  const base = itemBase(item);
  if (taxMode.value === 'perItem') return Math.floor(base * (1 + (Number(item.taxRate) || 0) / 100));
  return Math.round(base); // included: 税込そのまま / aggregate: 税抜のまま表示（課税は合計側で）
};

// 割り勘の負担額に使う「税込換算後」の商品金額
const itemShareAmount = (item) => {
  const base = itemBase(item);
  if (taxMode.value === 'included') return Math.round(base);
  return Math.floor(base * (1 + (Number(item.taxRate) || 0) / 100));
};

const itemsTotal = computed(() => {
  if (taxMode.value === 'aggregate') {
    // 税率ごとにまとめて課税（端数の切り捨ては税率グループごとに1回だけ）
    // 値引・返品のマイナス行も同じ税率グループに入るので、そのまま差し引かれる
    const groups = {};
    receiptItems.value.forEach(it => {
      const r = Number(it.taxRate) || 0;
      groups[r] = (groups[r] || 0) + itemBase(it);
    });
    return Object.entries(groups).reduce((sum, [r, net]) => sum + Math.floor(net * (1 + Number(r) / 100)), 0);
  }
  return receiptItems.value.reduce((sum, item) => sum + calcItemTotal(item), 0);
});

// ==========================================
// 🌟 不明な残金（内訳と会計総額の差額）の処理
// ==========================================
const remainderBearer = ref(''); // 差額を負担する人の名前（空＝立替者）
const remainderReason = ref(''); // 差額の理由（任意メモ）
const editNote = ref(''); // 編集時に相手へ添えるひとこと（任意）
const isSubmitting = ref(false); // 🌟 二重送信ガード（連打で支払いが二重計上されるのを防ぐ）

// 内訳の合計（割り勘方法に応じて）
const breakdownTotal = computed(() => {
  if (formData.value.splitType === 'item') return itemsTotal.value;
  if (formData.value.splitType === 'custom') {
    let sum = 0;
    (props.participants || []).forEach(p => { sum += Number(customSplitAmounts.value[p.name]) || 0; });
    return sum;
  }
  return Number(formData.value.amount) || 0;
});

// 会計総額 − 内訳合計（プラス＝足りない／マイナス＝多い）
const remainderDiff = computed(() => {
  if (formData.value.splitType !== 'item' && formData.value.splitType !== 'custom') return 0;
  return (Number(formData.value.amount) || 0) - breakdownTotal.value;
});
const remainderText = computed(() => {
  const d = remainderDiff.value;
  if (d > 0) return `¥${d.toLocaleString()} 足りません。どうしますか？`;
  return `¥${Math.abs(d).toLocaleString()} 多いです。どうしますか？`;
});

// 🌟 税率の切り替え機能（8% → 10% → 0%（非課税） → 8%…）
const toggleTax = (item) => {
  if (item.taxRate === 8) item.taxRate = 10;
  else if (item.taxRate === 10) item.taxRate = 0;
  else item.taxRate = 8;
};
const setGlobalTax = (rate) => {
  receiptItems.value.forEach(item => item.taxRate = rate);
};

// 🌟 緩やかな送信チェック（美しいモーダルに統一！）
const handleSubmit = () => {
  if (!formData.value.amount || !formData.value.itemName) {
    showModal({ type: 'error', title: '入力エラー', message: '合計金額と店名・内容は必須です！' });
    return;
  }
  
  if (formData.value.splitType === 'item') {
    const unassignedItem = receiptItems.value.find(item => item.assignees.length === 0);
    if (unassignedItem) {
      showModal({ type: 'error', title: '選択モレ', message: `「${unassignedItem.name}」を支払う人が選択されていません！` });
      return;
    }
  }

  if (formData.value.splitType === 'custom') {
    let sum = 0;
    (props.participants || []).forEach(p => { sum += Number(customSplitAmounts.value[p.name]) || 0; });
    if (sum <= 0) {
      showModal({ type: 'error', title: '入力エラー', message: '各メンバーの金額を入力してください。' });
      return;
    }
  }

  // 🌟 不明な残金がある場合＝画面下のパネルで選んだ負担者で確定してよいか、最終確認だけ挟む
  if (remainderDiff.value !== 0) {
    const bearerName = remainderBearer.value || formData.value.payer || '立替者';
    showModal({
      type: 'warning',
      title: '不明な残金があります',
      message: `内訳の合計（¥${breakdownTotal.value.toLocaleString()}）と会計総額（¥${Number(formData.value.amount).toLocaleString()}）に ¥${Math.abs(remainderDiff.value).toLocaleString()} の差額があります。\n\nこの差額は ${bearerName} さんの負担として精算します。よろしいですか？`,
      showCancel: true,
      confirmText: 'この内容で保存',
      cancelText: '戻って直す',
      onConfirm: () => executeSubmit(),
    });
    return;
  }

  // 金額が合っている場合はそのまま送信
  executeSubmit();
};

// 🌟 各メンバーの「負担額」を割り勘方法に応じて算出（uid基準・立替者の自己負担も含む）
const computeShares = () => {
  const arr = props.participants || [];
  const shares = {};
  const nameToUid = {};
  arr.forEach(p => { shares[p.id] = 0; nameToUid[p.name] = p.id; });

  if (formData.value.splitType === 'custom') {
    // 金額指定：各人が入力した額がそのまま負担額
    arr.forEach(p => { shares[p.id] = Number(customSplitAmounts.value[p.name]) || 0; });
  } else if (formData.value.splitType === 'item') {
    // 商品ごと：各商品（税込換算後）を支払う人で均等割りし、合算
    receiptItems.value.forEach(item => {
      const price = itemShareAmount(item);
      const assignees = item.assignees || [];
      if (assignees.length === 0) return;
      const per = Math.floor(price / assignees.length);
      assignees.forEach(name => {
        const uid = nameToUid[name];
        if (uid != null) shares[uid] += per;
      });
    });
  } else {
    // 全員で均等
    const per = Math.floor(Number(formData.value.amount) / (arr.length || 1));
    arr.forEach(p => { shares[p.id] = per; });
  }

  // 🌟 端数や「不明な残金」で合計がずれる分は、選んだ負担者（未選択なら立替者）に寄せて
  //    割り勘合計を必ず総額に一致させる → 「1円足りなくて決済が通らない」を根本から防ぐ
  const total = Number(formData.value.amount) || 0;
  const sum = arr.reduce((s, p) => s + (shares[p.id] || 0), 0);
  const diff = total - sum;
  if (diff !== 0) {
    const bearerObj = (remainderBearer.value && arr.find(p => p.name === remainderBearer.value))
      || arr.find(p => p.name === formData.value.payer)
      || arr.find(p => p.isMe)
      || arr[0];
    if (bearerObj) shares[bearerObj.id] = (shares[bearerObj.id] || 0) + diff;
  }

  return arr.map(p => ({ uid: p.id, name: p.name, amount: shares[p.id] || 0 }));
};

// 🌟 実際の送信処理（モーダルのOKボタンからも呼べるように分けたもの）
const executeSubmit = () => {
  if (isSubmitting.value) return; // 🌟 連打による二重送信（＝支払いの二重計上）を防ぐ
  isSubmitting.value = true;      //    送信後はモーダルが閉じて破棄されるので解除は不要
  console.log("🔥 モーダル内の送信処理を開始"); // 🌟 これが出るか？
  
  // new Date().toLocaleTimeString... の部分でエラーが出ることがあるので
  // 以下のように安全な書き方に変更してみてください
  const now = new Date();
  const currentTime = formData.value.time || 
                     `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 🌟 立替えた人（債権者）のUIDを名前から解決して一緒に渡す
  const payerObj = (props.participants || []).find(p => p.name === formData.value.payer);
  const payload = {
    editId: props.editData ? props.editData.id : null, // 🌟 編集なら対象ID
    editNote: props.editData ? (editNote.value.trim() || null) : null, // 🌟 編集時に添えるひとこと（任意）
    payer: formData.value.payer,
    payerUid: payerObj ? payerObj.id : (props.myUid || null),
    itemName: formData.value.itemName,
    category: formData.value.category, // 🌟 支払いジャンル
    registrationNumber: formData.value.registrationNumber || null, // 🌟 事業者登録番号
    splitType: formData.value.splitType,
    taxMode: taxMode.value, // 🌟 税の計算方法（再編集時に復元する）
    amount: Number(formData.value.amount),
    date: formData.value.date ? formData.value.date.replace(/-/g, '/') : "",
    time: currentTime,
    // 🌟 不明な残金（差額）の記録：誰が負担したか＋理由
    //    差額が無くても、メモ（ポイント利用など）があれば残す
    remainder: (remainderDiff.value !== 0 || remainderReason.value) ? {
      amount: remainderDiff.value,
      name: remainderBearer.value || formData.value.payer || '',
      reason: remainderReason.value || null,
    } : null,
    // 🌟 各メンバーの負担額（割り勘の正データ）
    shares: computeShares(),
    items: receiptItems.value.map(item => {
      const qty = item.qty || 1;
      const lineTotal = Number(item.price) || 0; // 印字どおりの行の合計
      return {
        name: item.name,
        price: itemShareAmount(item), // 税込換算後（表示・精算用）
        lineTotal, // 🌟 印字どおりの行の合計（再編集で復元する正データ）
        rawPrice: qty > 1 ? Math.round(lineTotal / qty) : lineTotal, // 単価（lineTotal を持たない古い記録との互換用）
        qty,
        taxRate: Number(item.taxRate) || 0,
        assignees: item.assignees
      };
    })
  };

  console.log("📦 パケット作成完了:", payload);
  emit('submit', payload);
  emit('close'); // 🌟 送信後に閉じる指示を出す
};
// 複数枚はレシートごとに立替者と割り方を確認する。保存に入ったカードは内容とIDを固定する。
const batchMode = ref(false);
const batchCards = ref([]);
const batchBusy = ref(false);
const batchReading = ref(false);
const batchMessage = ref('');
const batchRecoveryError = ref(false);
const batchDragging = ref(false);
const batchFileInput = ref(null);
const batchCameraInput = ref(null);
const batchOperationId = ref('');
let batchEpoch = 0;
const storageKey = () => `settlo:receipt-batch:v1:${props.myUid}:${props.eventId}`;
const defaultBatchPayerUid = () => participants.value.find(p => p.id === props.myUid)?.id || participants.value[0]?.id || '';
const newBatchCard = () => ({ id: crypto.randomUUID(), store: '', amount: '', date: '', receipt: null, image: '', state: 'reading', reasonText: '順番を待っています。', notice: '', readVersion: 0, plan: null, sideEffectFails: [], payerUid: defaultBatchPayerUid(), splitType: 'all', customAmounts: {}, allocationItems: [], settlementConfirmed: false });
const hasFrozenCards = computed(() => batchCards.value.some(c => c.plan));
const batchCanAdd = computed(() => !batchBusy.value && !batchReading.value && !hasFrozenCards.value && !batchRecoveryError.value && !props.eventEnded && batchCards.value.length < 5);
const batchTargets = computed(() => batchCards.value.filter(c => c.state === 'ready' && c.settlementConfirmed));
const batchTotal = computed(() => batchTargets.value.reduce((sum, c) => sum + Number(c.amount), 0));
const batchFinished = computed(() => batchCards.value.length > 0 && batchCards.value.every(c => ['saved', 'excluded'].includes(c.state)));
const batchSavedCount = computed(() => batchCards.value.filter(c => c.state === 'saved').length);
const batchSavedTotal = computed(() => batchCards.value.filter(c => c.state === 'saved').reduce((sum, c) => sum + Number(c.plan?.payment?.amount || 0), 0));
const batchCanSave = computed(() => {
  if (batchBusy.value || batchReading.value || batchRecoveryError.value || props.eventEnded || !props.myUid || !props.eventId || !batchTargets.value.length) return false;
  return batchTargets.value.every(card => batchSettlementPreview(card).ok);
});
const batchPrimaryLabel = computed(() => {
  if (batchBusy.value) return '保存結果を確認中…';
  if (batchTargets.value.length) return `${batchTargets.value.length}件・${batchTotal.value.toLocaleString('ja-JP')}円を登録`;
  if (batchCards.value.some(c => c.state === 'unknown')) return '保存結果を確認してください';
  if (batchCards.value.some(c => c.state === 'saveFailed')) return '保存できなかった項目があります';
  return batchCards.value.length ? 'レシートの内容と精算を確認' : 'レシートを追加してください';
});
const batchSummary = computed(() => {
  const count = state => batchCards.value.filter(c => c.state === state).length;
  const confirmable = batchCards.value.filter(c => ['ready', 'warn', 'readFailed'].includes(c.state)).length;
  const confirmed = batchCards.value.filter(c => c.settlementConfirmed && ['ready', 'warn', 'readFailed'].includes(c.state)).length;
  return `精算確認 ${confirmed}/${confirmable}件・保存済み ${count('saved')}件・保存失敗 ${count('saveFailed')}件・結果不明 ${count('unknown')}件・除外 ${count('excluded')}件`;
});
function persistBatch() {
  try {
    // 画像は保持しない。送信済みの内容とIDだけを、このタブで再開するために保持する。
    sessionStorage.setItem(storageKey(), JSON.stringify({ version: 2, operationId: batchOperationId.value, cards: batchCards.value.filter(c => c.plan).map(({ image, ...card }) => card) }));
    return true;
  } catch {
    batchMessage.value = '再開用の登録情報をこのタブに保持できません。新しい送信を止めています。';
    batchRecoveryError.value = true;
    return false;
  }
}
function loadBatch() {
  batchEpoch++;
  batchCards.value = [];
  batchBusy.value = false;
  batchReading.value = false;
  batchRecoveryError.value = false;
  batchMode.value = false;
  batchMessage.value = '';
  batchOperationId.value = '';
  if (!props.eventId || !props.myUid) return;
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (![1, 2].includes(saved.version) || !Array.isArray(saved.cards) || saved.cards.length > 5) throw new Error('invalid-recovery');
    batchOperationId.value = saved.version === 2 && typeof saved.operationId === 'string' && saved.operationId && !saved.operationId.includes('/')
      ? saved.operationId
      : crypto.randomUUID();
    const historyIds = new Set();
    for (const c of saved.cards) {
      if (!c.plan || c.plan.eventId !== props.eventId || !validateSavePlan(c.plan).ok || historyIds.has(c.plan.ids.historyId)) throw new Error('invalid-recovery');
      historyIds.add(c.plan.ids.historyId);
      c.state = c.state === 'saved' ? 'saved' : 'unknown';
      c.amount = String(c.plan.payment.amount);
      c.store = c.plan.payment.itemName;
      c.date = c.plan.payment.date.replaceAll('/', '-');
      c.receipt = c.plan.payment.receipt || null;
      c.payerUid = c.plan.creditorUid;
      c.splitType = c.plan.payment.splitType || 'all';
      c.customAmounts = Object.fromEntries(c.plan.shares.map(share => [share.uid, String(share.amount)]));
      c.allocationItems = (c.plan.payment.items || []).map(item => ({ ...item, assigneeUids: (item.assignees || []).map(name => participants.value.find(p => p.name === name)?.id).filter(Boolean) }));
      c.settlementConfirmed = true;
      c.reasonText = c.state === 'unknown' ? '前回の登録情報を復元しました。保存結果を確認してください。' : c.reasonText;
    }
    batchCards.value = saved.cards;
    if (saved.cards.length) {
      batchMode.value = true;
    }
  } catch {
    batchMode.value = true;
    batchRecoveryError.value = true;
    batchMessage.value = '前回の登録情報を復元できません。二重登録を避けるため送信を止めました。イベントの履歴を確認してください。';
  }
}
const batchSplitLabel = type => ({ all: '全員で均等', custom: '金額を指定', item: '商品ごと' })[type] || '割り方不明';
function invalidateBatchSettlement(card) {
  if (!card.plan) card.settlementConfirmed = false;
}
function batchCanUseItemSplit(card) {
  return Array.isArray(card.receipt?.items) && card.receipt.items.length > 0
    && card.receipt.items.every(item => Number.isInteger(item.lineTotal))
    && Array.isArray(card.allocationItems) && card.allocationItems.length === card.receipt.items.length
    && card.allocationItems.every(item => Number.isInteger(Number(item.price)));
}
function batchSettlementPreview(card) {
  const people = participants.value.map(p => ({ id: p.id, name: p.name }));
  const total = Number(card.amount);
  if (!Number.isInteger(total) || total < 1 || total > MAX_AMOUNT) return { ok: false, shares: [], message: '金額を確認してください。' };
  if (!people.some(p => p.id === card.payerUid)) return { ok: false, shares: [], message: '立替えた人を選んでください。' };
  try {
    if (card.splitType === 'all') return { ok: true, shares: evenShares(people, total, card.payerUid), message: '' };
    if (card.splitType === 'custom') {
      const shares = people.map(p => {
        const raw = String(card.customAmounts?.[p.id] ?? '');
        if (!/^\d+$/.test(raw)) throw new Error('custom-empty');
        return { uid: p.id, name: p.name, amount: Number(raw) };
      });
      if (shares.some(s => !Number.isInteger(s.amount) || s.amount < 0 || s.amount > MAX_AMOUNT)) throw new Error('custom-invalid');
      const sum = shares.reduce((value, share) => value + share.amount, 0);
      if (sum !== total) return { ok: false, shares, message: `指定額の合計を ${total.toLocaleString('ja-JP')}円にしてください（現在 ${sum.toLocaleString('ja-JP')}円）。` };
      return { ok: true, shares, message: '' };
    }
    if (card.splitType === 'item') {
      if (!batchCanUseItemSplit(card)) throw new Error('item-unavailable');
      const amounts = Object.fromEntries(people.map(p => [p.id, 0]));
      for (const item of card.allocationItems) {
        const assignees = [...new Set(item.assigneeUids || [])].filter(uid => uid in amounts);
        if (!assignees.length) return { ok: false, shares: [], message: `「${item.name || '品目名不明'}」を負担する人を選んでください。` };
        const amount = Number(item.price);
        const each = Math.floor(amount / assignees.length);
        assignees.forEach(uid => { amounts[uid] += each; });
        amounts[assignees.includes(card.payerUid) ? card.payerUid : assignees[0]] += amount - each * assignees.length;
      }
      amounts[card.payerUid] += total - Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
      const shares = people.map(p => ({ uid: p.id, name: p.name, amount: amounts[p.id] }));
      if (shares.some(s => !Number.isInteger(s.amount) || s.amount < 0)) return { ok: false, shares, message: '値引きを含む明細の負担額を確認できません。金額指定を使ってください。' };
      return { ok: true, shares, message: '' };
    }
  } catch {}
  return { ok: false, shares: [], message: '割り方を確認してください。' };
}
function updateBatchPayer(card, payerUid) {
  if (card.plan || batchBusy.value) return;
  card.payerUid = payerUid;
  invalidateBatchSettlement(card);
}
function setBatchSplitType(card, splitType) {
  if (card.plan || batchBusy.value || !['all', 'custom', 'item'].includes(splitType)) return;
  if (splitType === 'item' && !batchCanUseItemSplit(card)) return;
  card.splitType = splitType;
  if (splitType === 'custom' && !Object.values(card.customAmounts || {}).some(value => String(value) !== '')) {
    const shares = evenShares(participants.value, Number(card.amount) || 0, card.payerUid);
    card.customAmounts = Object.fromEntries(shares.map(share => [share.uid, String(share.amount)]));
  }
  if (splitType === 'item') card.allocationItems.forEach(item => { if (!item.assigneeUids.length) item.assigneeUids = participants.value.map(p => p.id); });
  invalidateBatchSettlement(card);
}
function updateBatchCustomAmount(card, uid, value) {
  if (card.plan || batchBusy.value) return;
  card.customAmounts[uid] = String(value || '').replace(/\D/g, '').slice(0, 8);
  invalidateBatchSettlement(card);
}
function toggleBatchItemAssignee(card, item, uid) {
  if (card.plan || batchBusy.value) return;
  const index = item.assigneeUids.indexOf(uid);
  if (index >= 0) item.assigneeUids.splice(index, 1); else item.assigneeUids.push(uid);
  invalidateBatchSettlement(card);
}
function confirmBatchSettlement(card) {
  if (card.plan || card.state !== 'ready' || !batchSettlementPreview(card).ok) return;
  card.settlementConfirmed = true;
}
function refreshBatchCard(card) {
  if (card.plan || card.state === 'excluded' || card.state === 'reading') return;
  const validAmount = /^\d+$/.test(card.amount) && Number(card.amount) >= 1 && Number(card.amount) <= MAX_AMOUNT;
  const validDate = isValidPaymentDate(card.date.replaceAll('-', '/'));
  card.state = validAmount && validDate ? 'ready' : 'warn';
  card.reasonText = [!validAmount && '1〜99,999,999円の整数を入力してください。', !validDate && 'レシートの日付を入力してください。', card.notice].filter(Boolean).join(' ');
}
function updateBatchAmount(card, value) {
  if (!getBatchCardState(card.state).canEditAmount || batchBusy.value) return;
  card.amount = value;
  invalidateBatchSettlement(card);
  refreshBatchCard(card);
}
function updateBatchStore(card, value) {
  if (!getBatchCardState(card.state).canEditAmount || batchBusy.value) return;
  card.store = String(value || '').slice(0, 60);
  invalidateBatchSettlement(card);
}
function updateBatchDate(card, value) {
  if (!getBatchCardState(card.state).canEditAmount || batchBusy.value) return;
  card.date = value;
  invalidateBatchSettlement(card);
  refreshBatchCard(card);
}
function excludeBatchCard(card) {
  if (!getBatchCardState(card.state).canExclude || batchBusy.value) return;
  card.previousState = card.state;
  card.readVersion++;
  card.state = 'excluded';
}
function restoreBatchCard(card) {
  if (!getBatchCardState(card.state).canRestore || batchBusy.value) return;
  card.state = card.previousState === 'reading' ? 'readFailed' : card.previousState;
  if (card.previousState === 'reading') card.notice = '読み取り中に除外しました。金額と日付を手で入力してください。';
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reader.onabort = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}
function normalizeBatchReceipt(data) {
  const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const number = (value, min, max) => {
    if (value === null || value === undefined || value === '' || !['number', 'string'].includes(typeof value)) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const time = text(data.time, 20);
  const registrationNumber = text(data.registrationNumber, 20);
  return {
    storeName: text(data.storeName, 60),
    date: typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) && isValidPaymentDate(data.date.replaceAll('-', '/')) ? data.date : '',
    time: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '',
    currency: text(data.currency, 8).toUpperCase(),
    totalAmount: number(data.totalAmount, 0, MAX_AMOUNT),
    pointsUsed: number(data.pointsUsed, 0, MAX_AMOUNT),
    taxIncluded: typeof data.taxIncluded === 'boolean' ? data.taxIncluded : null,
    registrationNumber: /^T\d{13}$/.test(registrationNumber) ? registrationNumber : '',
    items: (Array.isArray(data.items) ? data.items : []).slice(0, 100).map(raw => {
      const item = raw && typeof raw === 'object' ? raw : {};
      const quantity = number(item.quantity, 1, 999);
      return {
        name: text(item.name, 60),
        lineTotal: number(item.lineTotal ?? item.price, -9999999, 9999999),
        quantity: Number.isInteger(quantity) ? quantity : null,
        taxRate: number(item.taxRate, 0, 100),
      };
    }),
  };
}
function batchReceiptItems(receipt) {
  // 印字どおりの明細はreceiptに保持。既存の再編集画面へは金額が判明した行だけを渡す。
  return (receipt?.items || []).filter(item => Number.isInteger(item.lineTotal)).map(item => {
    const qty = item.quantity || 1;
    const taxRate = item.taxRate ?? 0;
    return { name: item.name || '不明な商品', lineTotal: item.lineTotal, qty, taxRate,
      rawPrice: qty > 1 ? Math.round(item.lineTotal / qty) : item.lineTotal,
      price: receipt.taxIncluded === false ? Math.floor(item.lineTotal * (1 + taxRate / 100)) : item.lineTotal,
      assignees: [],
    };
  });
}
async function processBatchFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || batchBusy.value || batchReading.value || hasFrozenCards.value || batchRecoveryError.value || props.eventEnded) return;
  if (batchCards.value.length + files.length > 5) {
    batchMessage.value = '一度に確認できるのは5枚までです。選ぶ枚数を減らしてください。';
    return;
  }
  const epoch = batchEpoch;
  const cards = files.map(() => newBatchCard());
  batchCards.value.push(...cards);
  batchReading.value = true;
  batchMessage.value = '1枚ずつ読み取ります。内容を確認してから登録してください。';
  for (let i = 0; i < cards.length; i++) {
    const card = batchCards.value.find(c => c.id === cards[i].id);
    if (epoch !== batchEpoch) return;
    if (card.state === 'excluded') continue;
    const version = card.readVersion;
    card.reasonText = 'この写真を読み取っています。';
    batchMessage.value = `${batchCards.value.indexOf(card) + 1} / ${batchCards.value.length}枚目を読み取り中です。`;
    try {
      if (!files[i].type.startsWith('image/') || files[i].size > 4 * 1024 * 1024) throw new Error('invalid-file');
      const image = await readFileAsDataUrl(files[i]);
      if (epoch !== batchEpoch || version !== card.readVersion) continue;
      card.image = image;
      // サーバーの120秒制限まで待つ。手前で次の画像へ進めて通信を重ねない。
      const result = await httpsCallable(getFunctions(app, 'asia-northeast1'), 'analyzeReceipt', { timeout: 130000 })({ image });
      if (epoch !== batchEpoch || version !== card.readVersion) continue;
      const data = normalizeBatchReceipt(result?.data || {});
      card.receipt = data;
      card.allocationItems = batchReceiptItems(data).map(item => ({ ...item, assigneeUids: [] }));
      card.store = data.storeName;
      const foreign = data.currency && data.currency !== 'JPY';
      const total = data.totalAmount;
      card.amount = !foreign && Number.isInteger(total) ? String(total) : '';
      card.date = data.date;
      card.notice = foreign ? '外貨の可能性があります。円で支払った金額を確認して入力してください。' : '';
      if (data.pointsUsed > 0) card.notice += ` ポイント利用 ${data.pointsUsed.toLocaleString()}円。合計はポイントを引く前の金額です。`;
      if (data.items.some(item => !Number.isInteger(item.lineTotal))) card.notice += ' 金額が不明な明細があります。写真と照らして合計を確認してください。';
      card.state = 'warn';
      refreshBatchCard(card);
    } catch (error) {
      if (epoch !== batchEpoch || version !== card.readVersion) continue;
      card.state = 'readFailed';
      card.notice = error.message === 'invalid-file' ? '4MB以下の画像を選んでください。手入力もできます。' : '読み取れませんでした。金額と日付を手で入力してください。';
      card.reasonText = card.notice;
    }
  }
  if (epoch === batchEpoch) {
    batchReading.value = false;
    batchMessage.value = '写真ごとの金額・日付と、読み取り詳細を確認してから登録してください。';
  }
}
async function onBatchFiles(event) {
  // FileListはinputのvalueを空にすると同時に空になるため、先に独立した配列へ退避する。
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  return processBatchFiles(files);
}
function onBatchDragOver() {
  if (batchCanAdd.value) batchDragging.value = true;
}
function onBatchDragLeave(event) {
  if (!event.currentTarget?.contains(event.relatedTarget)) batchDragging.value = false;
}
async function onBatchDrop(event) {
  batchDragging.value = false;
  if (!batchCanAdd.value) {
    batchMessage.value = batchCards.value.length >= 5
      ? '一度に確認できるのは5枚までです。登録後に次のレシートを追加できます。'
      : '現在の読み取りまたは保存を完了してから追加してください。';
    return;
  }
  return processBatchFiles(event.dataTransfer?.files);
}
function describeBatchFailure(reason) {
  const messages = {
    ended: 'イベントは終了しています。',
    'participants-changed': 'イベントの参加者が変更されています。',
    'permission-denied': '登録する権限を確認できませんでした。',
    unauthenticated: 'ログイン状態を確認してください。',
    'invalid-date': '日付が正しくありません。',
    'invalid-amount': '金額が正しくありません。',
    'invalid-event': 'イベントを確認できませんでした。',
    'not-saved': 'サーバーで未保存を確認しました。',
    'no-firestore': '保存の準備ができませんでした。',
  };
  return messages[reason] || '登録内容または通信状態を確認してください。';
}
function saveResultToCard(card, result) {
  card.state = ({ saved: 'saved', already: 'saved', failed: 'saveFailed', unknown: 'unknown' })[result.status] || 'unknown';
  card.sideEffectFails = result.sideEffectFails || card.sideEffectFails || [];
  card.reasonText = result.status === 'already' ? '同じIDの保存を確認しました。追加登録はしていません。'
    : card.state === 'unknown' ? '保存結果が分かりません。このタブを残して「保存結果を確認」を押してください。'
    : card.state === 'saveFailed' ? `保存されていません。${describeBatchFailure(result.reason)} 登録情報を保持しています。` : '';
  if (card.sideEffectFails.includes('チャット')) card.reasonText += ' 支払いは保存済みですが、チャットの反映を確認できません。';
  if (card.sideEffectFails.includes('お知らせ')) card.reasonText += ' 支払いは保存済みですが、お知らせの反映を確認できません。';
}
async function notifySavedCards(cards) {
  const targets = cards.filter(card => card.state === 'saved' && card.plan?.ids?.historyId);
  if (!targets.length) return;
  try {
    await publishPaymentAddedNotifications({
      eventId: props.eventId,
      operationId: batchOperationId.value,
      historyIds: [...new Set(targets.map(card => card.plan.ids.historyId))],
    });
    targets.forEach(card => { card.sideEffectFails = card.sideEffectFails.filter(kind => kind !== 'お知らせ'); });
  } catch {
    targets.forEach(card => {
      if (!card.sideEffectFails.includes('お知らせ')) card.sideEffectFails.push('お知らせ');
      if (!card.reasonText.includes('お知らせの反映を確認できません')) {
        card.reasonText += ' 支払いは保存済みですが、お知らせの反映を確認できません。';
      }
    });
  }
  persistBatch();
}
async function saveBatchCards(cards) {
  if (batchBusy.value || batchReading.value || batchRecoveryError.value || props.eventEnded || !props.eventId || !props.myUid) return;
  const targets = cards.filter(c => c.state === 'saveFailed' ? !!c.plan : (c.state === 'ready' && c.settlementConfirmed));
  const epoch = batchEpoch;
  const baseContext = { eventId: props.eventId, eventName: props.eventName, participantUids: participants.value.map(p => p.id), participantNames: Object.fromEntries(participants.value.map(p => [p.id, p.name])), eventEnded: props.eventEnded };
  const confirmed = [];
  batchBusy.value = true;
  try {
    for (const card of targets) {
      if (epoch !== batchEpoch) return;
      if (!card.plan) {
        if (!batchOperationId.value) batchOperationId.value = crypto.randomUUID();
        const preview = batchSettlementPreview(card);
        if (!preview.ok) throw new Error('invalid-settlement');
        const shares = preview.shares;
        const context = { ...baseContext, creditorUid: card.payerUid };
        const ids = await prepareSaveIds({ ...context, shares });
        if (epoch !== batchEpoch) return;
        const items = card.splitType === 'item'
          ? card.allocationItems.map(({ assigneeUids, ...item }) => ({ ...item, assignees: assigneeUids.map(uid => context.participantNames[uid]).filter(Boolean) }))
          : batchReceiptItems(card.receipt);
        const payment = { payer: context.participantNames[context.creditorUid], itemName: card.store || '不明な店舗', amount: Number(card.amount), date: card.date.replaceAll('-', '/'),
          time: card.receipt?.time || '', registrationNumber: card.receipt?.registrationNumber || null,
          splitType: card.splitType, taxMode: card.receipt?.taxIncluded === false ? 'aggregate' : 'included',
          items, receipt: card.receipt ? JSON.parse(JSON.stringify(card.receipt)) : null,
          remainder: card.notice ? { amount: 0, name: context.participantNames[context.creditorUid], reason: card.notice } : null };
        const plan = { ...context, shares, ids, payment };
        if (!validateSavePlan(plan).ok) throw new Error('invalid-plan');
        card.plan = plan;
      }
      card.state = 'saving';
      if (!persistBatch()) { card.state = 'saveFailed'; return; }
      let result;
      try { result = await saveOnePayment({ ...card.plan, previousSideEffectFails: card.sideEffectFails }); }
      catch { result = { status: 'unknown' }; }
      if (epoch !== batchEpoch) return;
      saveResultToCard(card, result);
      if (['saved', 'already'].includes(result.status)) confirmed.push(card);
      if (!persistBatch()) return;
    }
    if (epoch === batchEpoch) await notifySavedCards(confirmed);
  } catch {
    batchMessage.value = '登録の準備ができませんでした。参加者・立替者・金額・日付を確認してください。';
  } finally { if (epoch === batchEpoch) batchBusy.value = false; }
}
async function confirmBatchCard(card) {
  if (batchBusy.value || card.state !== 'unknown' || !card.plan) return;
  const epoch = batchEpoch;
  batchBusy.value = true;
  try {
    const result = await confirmSavedOnServer({ eventId: card.plan.eventId, historyId: card.plan.ids.historyId, plan: card.plan });
    if (epoch !== batchEpoch) return;
    saveResultToCard(card, result);
    if (result.status === 'saved') {
      const recovery = await recoverPaymentSideEffects({ ...card.plan, previousSideEffectFails: card.sideEffectFails });
      card.sideEffectFails = recovery.sideEffectFails || card.sideEffectFails;
      card.reasonText = card.sideEffectFails.includes('チャット')
        ? '支払いは保存済みですが、チャットの反映を確認できません。'
        : '支払いとチャットの保存を確認しました。';
      await notifySavedCards([card]);
    }
    persistBatch();
  } finally { if (epoch === batchEpoch) batchBusy.value = false; }
}
function startNextBatch() {
  if (batchBusy.value || batchReading.value || batchRecoveryError.value || batchCards.value.some(c => !['saved', 'excluded'].includes(c.state))) return;
  batchCards.value = [];
  batchOperationId.value = '';
  if (!persistBatch()) return;
  batchMessage.value = '';
}
watch(() => [props.eventId, props.myUid], loadBatch, { immediate: true });
watch(participants, list => {
  if (hasFrozenCards.value) return;
  const ids = new Set(list.map(p => p.id));
  const fallback = list.find(p => p.id === props.myUid)?.id || list[0]?.id || '';
  batchCards.value.forEach(card => {
    if (!ids.has(card.payerUid)) card.payerUid = fallback;
    card.allocationItems?.forEach(item => { item.assigneeUids = (item.assigneeUids || []).filter(uid => ids.has(uid)); });
    card.customAmounts = Object.fromEntries(Object.entries(card.customAmounts || {}).filter(([uid]) => ids.has(uid)));
    invalidateBatchSettlement(card);
  });
}, { deep: true });

</script>

<style scoped>
/* 🌟 モーダル全体のベース */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--c-overlay); display: flex; align-items: flex-end; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
.modal-content { background: #f4f7f9; width: 100%; max-width: 600px; border-radius: 32px 32px 0 0; display: flex; flex-direction: column; max-height: 90vh; }

.modal-header { padding: 26px 22px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 1px solid rgba(0,0,0,0.06); background: white; border-radius: 28px 28px 0 0; flex-shrink: 0; }
.modal-title { margin: 0; font-size: 20px; color: var(--c-ink); font-weight: 900; line-height: 1.3; }
.close-btn { background: var(--c-surface-2); border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; color: var(--c-text-sub); cursor: pointer; font-weight: bold; }

.scroll-area { overflow-y: auto; padding: 20px 24px; flex: 1; }

/* 🌟 1. レシート撮影・選択エリア */
.upload-section { margin-bottom: 24px; }
.hidden-input { display: none; }
.drop-zone { border: 2px dashed var(--c-line-strong); border-radius: 20px; background: white; padding: 20px; text-align: center; transition: 0.2s; position: relative; overflow: hidden; min-height: 140px; display: flex; align-items: center; justify-content: center; }
.drop-zone.is-dragover { border-color: var(--c-brand); background: var(--c-brand-weak); }
.drop-zone.is-analyzing { border-color: var(--c-pay); background: #fffbeb; }

.upload-placeholder { width: 100%; }
.upload-hint { font-size: 13px; font-weight: 800; color: var(--c-text-sub); margin: 0 0 15px 0; }
.upload-actions { display: flex; gap: 10px; justify-content: center; }
.upload-action-btn { flex: 1; background: var(--c-surface-2); border: 1px solid var(--c-line-bold); padding: 12px; border-radius: 16px; font-size: 12px; font-weight: 900; color: var(--c-text); cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.upload-action-btn:active { transform: scale(0.96); background: var(--c-line-bold); }
.upload-action-btn__icon { width: 26px; height: 26px; fill: none; stroke: var(--c-brand); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

/* AI解析中のアニメーション */
.analyzing-view { width: 100%; height: 100%; position: absolute; top: 0; left: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); z-index: 10; }
.scanning-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.4; position: absolute; top: 0; left: 0; }
.scan-line { position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: var(--c-brand); box-shadow: 0 0 15px var(--c-brand); animation: scan 1.5s infinite linear; z-index: 11; }
@keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
.analyzing-text { position: relative; z-index: 12; color: white; font-weight: 900; font-size: 14px; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 20px; backdrop-filter: blur(4px); }
.spinner { width: 16px; height: 16px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s infinite linear; }
@keyframes spin { to { transform: rotate(360deg); } }

/* アップロード完了後 */
.upload-preview { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
.preview-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.3; }
.success-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%); background: var(--c-brand); color: white; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 900; box-shadow: 0 4px 10px rgba(5,150,105,0.3); }
.re-upload-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, 20%); background: rgba(15,23,42,0.8); color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; backdrop-filter: blur(4px); cursor: pointer; }

/* 🌟 レシート読み取りの注意書き */
.ocr-notice { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 16px; padding: 12px 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
.ocr-notice-line { margin: 0; font-size: 12.5px; line-height: 1.6; font-weight: 700; color: #92400e; }

/* 🌟 2. 基本情報のカード */
.basic-info-card { background: white; border-radius: 24px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); margin-bottom: 24px; display: flex; flex-direction: column; gap: 16px; }
.input-row label { display: block; font-size: 12px; font-weight: 800; color: var(--c-text-sub); margin-bottom: 6px; }
.hint-text { font-weight: normal; font-size: 10px; color: var(--c-text-faint); } 
/* 🌟 日付と時間は「縦並び」にする（横並びだと密着して見えるため確実に分離） */
.half-row { display: flex; flex-direction: column; gap: 18px; }
.half { width: 100%; min-width: 0; }
.half .standard-input { width: 100%; min-width: 0; }

.amount-input-wrapper { display: flex; align-items: baseline; gap: 4px; border-bottom: 2px solid var(--c-line-bold); padding-bottom: 4px; transition: 0.2s; }
.amount-input-wrapper:focus-within { border-color: var(--c-pay); }
.currency-mark { font-size: 24px; font-weight: 900; color: var(--c-text); }
.amount-input { flex: 1; border: none; outline: none; font-size: 36px; font-weight: 900; color: var(--c-ink); background: transparent; letter-spacing: -1px; width: 100%; }
.amount-input::placeholder { color: var(--c-line-strong); }
.currency-unit { font-size: 16px; font-weight: 800; color: var(--c-text-sub); }

.standard-input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--c-line-bold); background: var(--c-surface-2); font-size: 14px; font-weight: 800; color: var(--c-text); outline: none; box-sizing: border-box; transition: 0.2s; }
.standard-input:focus { border-color: var(--c-brand); background: white; }
.select-style { appearance: none; cursor: pointer; }
.payer-hint { font-size: 11px; color: var(--c-brand); background: var(--c-brand-weak); padding: 8px 12px; border-radius: 10px; margin: 0; font-weight: 700; }

/* 🌟 支払いジャンル選択 */
.category-section { margin-bottom: 20px; }
.category-row { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 6px; -webkit-overflow-scrolling: touch; }
.category-row::-webkit-scrollbar { height: 0; }
.cat-chip { flex: 0 0 auto; width: 64px; background: var(--c-surface-2); border: 1.5px solid var(--c-line-bold); border-radius: 16px; padding: 10px 4px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--c-text-sub); cursor: pointer; transition: 0.15s; }
.cat-chip:active { transform: scale(0.96); }
.cat-icon { width: 24px; height: 24px; color: var(--c-text-sub); }
.cat-label { font-size: 10px; font-weight: 800; }
.cat-chip.active { border-color: var(--c-brand); background: var(--c-brand-weak); color: var(--c-brand-strong); }
.cat-chip.active .cat-icon { color: var(--c-brand); }

/* 🌟 3. 割り勘タイプ選択 */
.split-type-section { margin-bottom: 16px; }
.section-sub-title { font-size: 14px; font-weight: 900; color: var(--c-ink); margin: 0 0 10px 0; }
.ios-segmented-control { display: flex; background: var(--c-line-bold); border-radius: 12px; padding: 4px; }
.ios-segmented-control button { flex: 1; padding: 10px 0; border: none; background: transparent; font-weight: 800; font-size: 12px; color: var(--c-text-sub); border-radius: 10px; cursor: pointer; transition: 0.2s; }
.ios-segmented-control button.active { background: white; color: var(--c-ink); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

/* 🌟 4. 動的セクション */
.dynamic-section { margin-bottom: 24px; }
.section-desc { font-size: 12px; color: var(--c-text-sub); font-weight: 700; margin: 0 0 12px 0; }

.split-result-box { background: white; border: 2px solid var(--c-brand); border-radius: 20px; padding: 20px; text-align: center; }
.split-desc { font-size: 12px; color: var(--c-brand); font-weight: 800; }
.split-calc-amount { font-size: 28px; font-weight: 900; color: var(--c-text); margin: 8px 0 0 0; }

/* カスタム（金額指定） */
.custom-split-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.remaining-text { font-size: 13px; font-weight: 900; color: var(--c-brand); background: var(--c-brand-weak); padding: 4px 10px; border-radius: 12px; transition: 0.2s; }
.remaining-text.error { color: var(--c-danger); background: var(--c-danger-weak); }
.ai-hint { font-size: 11px; font-weight: 800; color: var(--c-brand); text-align: center; margin-top: 12px; }

.custom-split-list { background: white; border-radius: 20px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.custom-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px dashed var(--c-line-bold); }
.custom-item:last-child { border-bottom: none; }
.user-info { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; color: var(--c-text); }

.custom-input-box { display: flex; align-items: baseline; gap: 4px; font-size: 14px; font-weight: 800; color: var(--c-text-sub); }
.custom-input-box input { width: 80px; text-align: right; font-size: 18px; font-weight: 900; border: none; border-bottom: 2px solid var(--c-line-bold); outline: none; color: var(--c-ink); padding-bottom: 2px; }

/* 商品ごとに指定 */
.item-split-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
.add-item-btn { background: var(--c-brand-weak); color: var(--c-brand); border: none; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; }
.receipt-items-list { display: flex; flex-direction: column; gap: 12px; }
.empty-items { background: white; padding: 30px; text-align: center; border-radius: 20px; border: 2px dashed var(--c-line-strong); font-size: 12px; font-weight: 800; color: var(--c-text-faint); }
.receipt-item-card { background: white; border-radius: 20px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border: 1px solid var(--c-surface-2); }
.item-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.item-name-input { flex: 1; border: none; border-bottom: 2px solid var(--c-line-bold); font-size: 16px; /* 16px未満にするとiOSで入力時に画面が拡大する */ font-weight: 900; color: var(--c-text); padding-bottom: 4px; outline: none; }
.item-price-box { display: flex; align-items: baseline; gap: 2px; font-weight: 800; color: var(--c-text-sub); }
.item-price-input { width: 60px; text-align: right; border: none; border-bottom: 2px solid var(--c-line-bold); font-size: 16px; font-weight: 900; color: var(--c-ink); outline: none; }
.remove-item-btn { background: var(--c-danger-weak); color: var(--c-danger); border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.remove-item-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

.item-assignees { background: var(--c-surface-2); padding: 12px; border-radius: 12px; }
.assign-label { font-size: 11px; color: var(--c-text-sub); font-weight: 800; display: block; margin-bottom: 8px; }
.assign-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { background: white; border: 1px solid var(--c-line-strong); color: var(--c-text-sub); padding: 6px 12px; border-radius: 16px; font-size: 11px; font-weight: 800; cursor: pointer; transition: 0.2s; }
.chip.selected { background: var(--c-brand); border-color: var(--c-brand); color: white; box-shadow: 0 2px 6px rgba(5,150,105,0.3); }

/* 🌟 フッター（固定） */
.modal-footer { padding: 16px 24px 30px; background: white; border-top: 1px solid rgba(0,0,0,0.05); }
.edit-note { margin-bottom: 24px; }
.submit-btn { width: 100%; background-color: var(--c-brand); color: white; border: none; padding: 18px; border-radius: var(--r-pill); font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(5,150,105,0.25); transition: 0.2s; }
.submit-btn:active { transform: scale(0.96); }
.submit-btn:disabled { opacity: 0.5; box-shadow: none; cursor: default; }

.slide-in { animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

/* 🌟 追加：金額一致チェックのスタイル */
.header-left { display: flex; flex-direction: column; gap: 6px; }
.match-status { font-size: 13px; font-weight: 900; margin: 0; padding: 4px 10px; border-radius: 8px; display: inline-block; align-self: flex-start; transition: 0.3s; }
.match-status.matched { color: var(--c-brand); background: var(--c-brand-tint); }
.match-status.error { color: var(--c-danger); background: #fee2e2; border: 1px dashed var(--c-danger); }

/* 🌟 UX向上：商品ごとのレイアウト */
/* 🌟 税の計算方法セレクタ */
.tax-mode-box { background: var(--c-surface-2); border: 1px solid var(--c-line-bold); border-radius: 14px; padding: 12px; margin-bottom: 14px; }
.tax-mode-title { margin: 0 0 8px; font-size: 12px; font-weight: 800; color: var(--c-text-strong); }
.tax-mode-seg { display: flex; gap: 6px; }
.tax-mode-seg button {
  flex: 1; padding: 9px 4px; border-radius: 10px; font-size: 11.5px; font-weight: 700;
  background: #fff; border: 1.5px solid var(--c-line-bold); color: var(--c-text-sub); transition: all 0.15s ease; line-height: 1.3;
}
.tax-mode-seg button.active { background: var(--c-brand); border-color: var(--c-brand); color: #fff; }
.tax-mode-desc { margin: 8px 0 0; font-size: 11px; color: var(--c-text-faint); line-height: 1.5; }

/* 🌟 合計チェック＆不明な残金パネル */
.total-summary { background: #fff; border: 1.5px solid var(--c-line-bold); border-radius: 14px; padding: 14px; margin-top: 14px; }
.ts-row { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; color: var(--c-text-strong); padding: 3px 0; }
.ts-row b { font-size: 15px; color: var(--c-ink); font-variant-numeric: tabular-nums; }
.ts-ok { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: var(--c-brand-weak); color: var(--c-brand); font-size: 12.5px; font-weight: 700; text-align: center; }
.remainder-box { margin-top: 10px; padding: 12px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a; }
.rb-title { margin: 0 0 10px; font-size: 13.5px; font-weight: 800; color: #b45309; }
.rb-field { margin-bottom: 10px; }
.rb-field:last-child { margin-bottom: 0; }
.rb-field label { display: block; font-size: 11.5px; font-weight: 700; color: #92400e; margin-bottom: 5px; }

.global-tax-control { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 11px; font-weight: 800; color: var(--c-text-sub); }
.global-tax-btn { padding: 6px 10px; border-radius: 12px; border: 1px solid var(--c-line-strong); background: white; cursor: pointer; color: var(--c-text-strong); font-weight: bold; transition: 0.2s; }
.global-tax-btn:active { background: var(--c-surface-2); }

.item-main-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.item-math-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }

.qty-control { display: flex; align-items: center; background: var(--c-surface-2); border-radius: 12px; overflow: hidden; border: 1px solid var(--c-line-bold); }
.qty-control button { width: 32px; height: 32px; border: none; background: transparent; color: var(--c-text-strong); font-size: 16px; font-weight: bold; cursor: pointer; }
.qty-control button:active { background: var(--c-line-bold); }
.qty-control span { width: 24px; text-align: center; font-size: 14px; font-weight: 900; color: var(--c-text); }

.tax-toggle-btn { padding: 6px 10px; border-radius: 10px; font-size: 12px; font-weight: 900; border: 1px solid var(--c-line-strong); cursor: pointer; background: white; transition: 0.2s; }
.tax-toggle-btn.tax-0 { color: var(--c-text-sub); }
.tax-toggle-btn.tax-8 { color: var(--c-pay-strong); border-color: var(--c-pay); background: var(--c-pay-weak); }
.tax-toggle-btn.tax-10 { color: var(--c-danger); border-color: var(--c-danger); background: var(--c-danger-weak); }

.item-subtotal { text-align: right; font-size: 12px; color: var(--c-text-sub); margin-bottom: 16px; font-weight: 700; border-bottom: 1px dashed var(--c-line-bold); padding-bottom: 12px; }
.item-subtotal strong { font-size: 18px; color: var(--c-ink); margin-left: 6px; }

.header-left { display: flex; flex-direction: column; gap: 6px; }
.match-status { font-size: 12px; font-weight: 900; margin: 0; padding: 6px 12px; border-radius: 10px; display: inline-block; align-self: flex-start; transition: 0.3s; }
.match-status.matched { color: var(--c-brand); background: var(--c-brand-tint); }
.match-status.error { color: var(--c-danger); background: #fee2e2; border: 1px dashed var(--c-danger); }
</style>
<style scoped>
.receipt-mode { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; margin: 12px 24px; padding: 4px; border: 1px solid var(--c-line-bold); border-radius: 16px; background: var(--c-surface-2); }
.receipt-mode button { min-width: 0; min-height: 46px; padding: 10px 8px; border: 0; border-radius: 12px; background: transparent; color: var(--c-text-sub); font-size: 14px; font-weight: 800; }
.receipt-mode button.active { color: var(--c-brand-strong); background: var(--c-brand-weak); box-shadow: inset 0 0 0 1.5px var(--c-brand); }
.receipt-mode button:focus-visible { outline: 3px solid color-mix(in srgb, var(--c-brand) 28%, transparent); outline-offset: 2px; }
.batch-body { overscroll-behavior: contain; padding-bottom: 34px; }
.batch-intro { margin-top: 14px; padding: 16px; border: 1px solid var(--c-line-bold); border-radius: 18px; background: white; }
.batch-intro-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.batch-intro h3 { margin: 0; font-size: 16px; color: var(--c-ink); }
.batch-intro-head span { flex: 0 0 auto; padding: 5px 10px; border-radius: 999px; background: var(--c-brand-weak); color: var(--c-brand-strong); font-size: 12px; font-weight: 900; }
.batch-intro p { margin: 8px 0 0; color: var(--c-text-sub); font-size: 12px; font-weight: 700; line-height: 1.65; }
.batch-complete { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid color-mix(in srgb, var(--c-brand) 35%, white); border-radius: 18px; background: var(--c-brand-weak); }
.batch-complete-icon { flex: 0 0 auto; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: var(--c-brand); color: white; font-size: 22px; font-weight: 900; }
.batch-complete h3 { margin: 0; color: var(--c-brand-strong); font-size: 16px; }
.batch-complete p { margin: 4px 0 0; color: var(--c-text-sub); font-size: 12px; line-height: 1.55; }
.batch-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; margin: 12px 0; }
.batch-field .standard-input { font-size: 16px; }
.batch-entry { margin: 16px 0; padding: 0; border: 0; min-width: 0; }
.batch-entry legend { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.batch-finished-card { padding: 14px 16px; border: 1px solid var(--c-line-bold); border-radius: 16px; background: white; }
.batch-finished-main { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; }
.batch-finished-main > span { min-width: 48px; height: 28px; padding: 0 9px; display: grid; place-items: center; box-sizing: border-box; border-radius: 999px; background: var(--c-brand-weak); color: var(--c-brand-strong); font-size: 11px; font-weight: 900; line-height: 1; white-space: nowrap; }
.batch-finished-main div { min-width: 0; }
.batch-finished-main strong, .batch-finished-main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-finished-main strong { font-size: 14px; }.batch-finished-main small { margin-top: 3px; color: var(--c-text-sub); font-size: 11px; }
.batch-finished-main b { color: var(--c-ink); font-size: 16px; white-space: nowrap; }
.batch-finished-card > p, .batch-finished-card details p { margin: 9px 0 0; color: var(--c-text-sub); font-size: 12px; }
.batch-finished-card > .batch-finished-warning { padding: 9px 10px; border-radius: 10px; background: #fff7ed; color: #9a3412; font-weight: 700; line-height: 1.55; }
.batch-finished-card details { margin-top: 9px; border-top: 1px solid var(--c-line-bold); }
.batch-finished-card summary { min-height: 42px; display: flex; align-items: center; color: var(--c-brand-strong); font-size: 12px; font-weight: 800; cursor: pointer; }
.batch-finished-card.excluded { opacity: .7; }
.batch-settlement { margin-top: 10px; padding: 16px; border: 1px solid var(--c-line-bold); border-radius: 20px; background: white; }
.batch-settlement-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.batch-settlement-head h4 { margin: 0; color: var(--c-ink); font-size: 15px; }
.batch-settlement-head span { flex: 0 0 auto; padding: 5px 9px; border-radius: 999px; background: var(--c-surface-2); color: var(--c-text-sub); font-size: 11px; font-weight: 900; }
.batch-settlement-head span.confirmed { background: var(--c-brand-weak); color: var(--c-brand-strong); }
.batch-split-tabs { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 6px; margin: 12px 0; }
.batch-split-tabs button { min-height: 44px; padding: 7px 5px; border: 1px solid var(--c-line-bold); border-radius: 11px; background: var(--c-surface-2); color: var(--c-text-sub); font-size: 11px; font-weight: 800; }
.batch-split-tabs button.active { border-color: var(--c-brand); background: var(--c-brand-weak); color: var(--c-brand-strong); }
.batch-split-tabs button:disabled { opacity: .42; }
.batch-settlement-note { margin: 8px 0; color: var(--c-text-sub); font-size: 11px; line-height: 1.55; }
.batch-custom-grid { display: grid; gap: 8px; }
.batch-custom-grid label { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--c-text-sub); font-size: 13px; font-weight: 700; }
.batch-custom-grid label span { display: flex; align-items: center; gap: 5px; }
.batch-custom-grid input { width: 100px; min-height: 42px; box-sizing: border-box; border: 1px solid var(--c-line-bold); border-radius: 10px; background: var(--c-surface-2); padding: 8px; text-align: right; font-size: 16px; font-weight: 800; }
.batch-item-splits { display: grid; gap: 10px; margin: 12px 0; }
.batch-item-split { padding: 11px; border: 1px solid var(--c-line-bold); border-radius: 12px; background: var(--c-surface-2); }
.batch-item-split p { display: flex; justify-content: space-between; gap: 8px; margin: 0 0 8px; font-size: 12px; }
.batch-item-split div { display: flex; flex-wrap: wrap; gap: 6px; }
.batch-item-split button { min-height: 38px; padding: 7px 9px; border: 1px solid var(--c-line-bold); border-radius: 999px; background: white; color: var(--c-text-sub); font-size: 11px; }
.batch-item-split button.active { border-color: var(--c-brand); background: var(--c-brand-weak); color: var(--c-brand-strong); font-weight: 800; }
.batch-share-preview { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; padding: 11px; border-radius: 12px; background: var(--c-surface-2); }
.batch-share-preview strong { flex-basis: 100%; font-size: 12px; }
.batch-share-preview span { padding: 5px 8px; border-radius: 999px; background: white; color: var(--c-text); font-size: 11px; font-weight: 800; }
.batch-share-preview p { margin: 0; color: var(--c-pay-strong); font-size: 12px; line-height: 1.55; }
.batch-confirm-settlement { width: 100%; min-height: 46px; margin-top: 12px; border: 1px solid var(--c-brand); border-radius: 12px; background: white; color: var(--c-brand-strong); font-size: 14px; font-weight: 900; }
.batch-confirm-settlement.confirmed { background: var(--c-brand); color: white; }
.batch-confirm-settlement:disabled { opacity: .45; }
.batch-settlement-frozen p { margin: 10px 0; color: var(--c-text-sub); font-size: 12px; }
.batch-capture-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.batch-drop-zone { padding: 8px; border: 2px dashed transparent; border-radius: 20px; transition: border-color .16s ease, background .16s ease; }
.batch-drop-zone.is-dragover { border-color: var(--c-brand); background: var(--c-brand-weak); }
.batch-drop-zone.is-disabled { opacity: .72; }
.batch-drop-copy { display: block; margin: 9px 4px 1px; color: var(--c-text-sub); font-size: 11px; font-weight: 700; text-align: center; }
.batch-capture-button { flex: 1 1 130px; min-height: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 12px 8px; border: 1px solid var(--c-line-bold); border-radius: 16px; background: white; color: var(--c-text); }
.batch-capture-button svg { width: 25px; height: 25px; fill: none; stroke: var(--c-brand); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.batch-capture-button strong { font-size: 14px; }
.batch-capture-button span { color: var(--c-text-sub); font-size: 11px; }
.batch-capture-button:disabled { opacity: .45; }
.batch-photo-hint { margin: 10px 2px 0; color: var(--c-text-sub); font-size: 12px; line-height: 1.6; }
.batch-message { font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.batch-secondary { min-height: 46px; padding: 12px 14px; font-size: 14px; border: 1px solid var(--c-line-bold); border-radius: 12px; background: white; color: var(--c-text); }
.batch-secondary:disabled, .receipt-mode button:disabled { opacity: .5; }
@media (max-width: 600px) { .batch-drop-copy { display: none; } }
@media (max-width: 360px) { .batch-body { padding: 16px; } }
</style>
