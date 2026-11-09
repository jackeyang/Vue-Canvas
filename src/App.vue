<template>
  <a class="skip-link" href="#main-content">跳转到主内容</a>
  <RouterView />
</template>

<style scoped>
.skip-link {
  position: absolute;
  top: -100px;
  left: 12px;
  z-index: 100;
  padding: 8px 14px;
  color: #fff;
  background: #1d4ed8;
  border-radius: 6px;
}

.skip-link:focus {
  top: 12px;
}
</style>
