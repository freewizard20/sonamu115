const carouselSlide = document.querySelector(".carousel-slide");
const carouselImages = document.getElementsByClassName('gallery_item');

const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
let counter = 0;
let delay = 0;

if (typeof window.console == "undefined") {
    window.console = {
        log: function (msg) {
            // Do Nothing
        }
    };
}

const size = carouselImages[0].clientWidth;
carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";

setInterval(function(){
    if(delay===0) {
        if(counter>=carouselImages.length-1){
            carouselSlide.style.transition = 'none';
            counter = 0;
            carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";
            return;
        }
        carouselSlide.style.transition = "transform 0.8s ease-in-out";
        counter++;
        carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";
    }
    else delay = 0;
},3000);


nextBtn.addEventListener("click", function(){
    delay++;
    if(counter>=carouselImages.length-1){
        carouselSlide.style.transition = 'none';
        counter = 0;
        carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";
        return;
    }
    carouselSlide.style.transition = "transform 0.8s ease-in-out";
    counter++;
    carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";
});


prevBtn.addEventListener("click", function() {
    delay++;
    if(counter<=0){
        carouselSlide.style.transition = "none";
        counter = carouselImages.length - 1;
        carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";
        return;        
    } 
    carouselSlide.style.transition = "transform 0.8s ease-in-out";
    counter--;
    carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";
});

/*carouselSlide.addEventListener('transitionend',function(){
    if(carouselImages[counter].id === 'lastClone'){
        carouselSlide.style.transition = 'none';
        counter = carouselImages.length - 1;
        carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";
        return;
    }
    if(carouselImages[counter].id === 'firstClone'){
        carouselSlide.style.transition = 'none';
        counter = 0;
        carouselSlide.style.transform = "translateX(" + (-size * counter) + "px)";
        return;
    }
})*/
