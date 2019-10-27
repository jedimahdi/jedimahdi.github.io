function myFunction(icon) {
    icon.classList.toggle('clicked');

    const x = document.getElementById('main-nav');
    if (x.style.display === 'block') {
        x.style.display = 'none';
    } else {
        x.style.display = 'block';
    }
}

function openComment(commentName, elmnt) {
    let i;
    const tabcontent = document.getElementsByClassName('comment');
    const tablinks = document.getElementsByClassName('tablink');

    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = 'none';
    }

    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].style.opacity = 0.3;
    }

    document.getElementById(commentName).style.display = 'block';

    elmnt.style.opacity = 1;
}

document.getElementById('defaultComment').click();

$(document).ready(function() {
    $('.slick').slick({
        dots: true,
        infinite: true,
        speed: 300,
        slidesToShow: 1,
        adaptiveHeight: true,
        nextArrow:
            '<button type="button" class="slick-next"><i class="fa fa-angle-right"></i></button>',
        prevArrow:
            '<button type="button" class="slick-prev"><i class="fa fa-angle-left"></i></button>'
    });
});
